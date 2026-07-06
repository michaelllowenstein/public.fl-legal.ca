/**
 * routes/calc-config.ts
 *
 * GET   /api/calc-config   — full calculator config tree           (public)
 * PATCH /api/calc-config   — update one field                      (calc JWT)
 * PUT   /api/calc-config   — replace the entire tree                (calc JWT)
 *                            (used by "Apply JSON" and "Reset to Defaults"
 *                            in the admin settings panel)
 *
 * ── Firebase schema (under public/calcConfig/) ────────────────────────────────
 *
 *   <tab>: {
 *     fields: {
 *       <fieldKey>: {
 *         included: boolean,
 *         taxable?: boolean,
 *         label?:   string,
 *         default?: number,
 *       }
 *     },
 *     disclaimer: string
 *   }
 *
 * ── PATCH body ────────────────────────────────────────────────────────────────
 *   { key: "sale/fields/otherDisbursements/default",   value: 200  }
 *   { key: "sale/fields/otherDisbursements/included",  value: true }
 *   { key: "sale/disclaimer",                          value: "New text" }
 *
 * The key is slash-delimited and relative to /public/calcConfig/. Structure
 * and access model deliberately mirror routes/content.ts, since this is the
 * same kind of thing: an editor-only config value with an audit trail.
 *
 * Every successful write (PATCH or PUT) also appends an entry under
 * public/audit/calcConfig/<timestamp> — a durable, server-side record of
 * exactly what changed, by whom, and when. This is the definitive way to
 * confirm "was this actually saved, and how" after the fact, independent of
 * whatever the client's own in-memory sync log says.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { dbGet, dbMultiUpdate } from '../services/firebase';
import { calcConfigPatchSchema } from '@schema';

const ROOT = 'calcConfig';

const VALID_TABS = new Set([
  'purchase-mortgage',
  'cash-purchase',
  'sale',
  'refinance',
  'wills',
  'incorporation',
]);

type PatchValue = string | number | boolean;
type ExpectedType = 'string' | 'number' | 'boolean';

interface KeyCheck {
  valid: boolean;
  expectedType?: ExpectedType;
  error?: string;
}

/**
 * Validates a calc-config key path and infers the value type expected at
 * that path. Accepts:
 *   <tab>/disclaimer
 *   <tab>/fields/<field>/included|taxable|label|default
 *
 * This checks structural shape and tab membership only — like content.ts's
 * VALID_SECTIONS check, it does not verify the specific field name already
 * exists in that tab's config. That's a reasonable place to add stricter
 * validation later if arbitrary field creation becomes a concern.
 */
function validateKey(key: string): KeyCheck {
  const parts = key.split('/');
  const [tab, second, , property] = parts;

  if (!VALID_TABS.has(tab)) {
    return { valid: false, error: `Invalid tab '${tab}'. Must be one of: ${[...VALID_TABS].join(', ')}` };
  }

  if (parts.length === 2 && second === 'disclaimer') {
    return { valid: true, expectedType: 'string' };
  }

  if (parts.length === 4 && second === 'fields') {
    if (property === 'included' || property === 'taxable') return { valid: true, expectedType: 'boolean' };
    if (property === 'label')   return { valid: true, expectedType: 'string' };
    if (property === 'default') return { valid: true, expectedType: 'number' };
    return {
      valid: false,
      error: `Invalid field property '${property}'. Must be one of: included, taxable, label, default`,
    };
  }

  return {
    valid: false,
    error: `Invalid key format '${key}'. Expected '<tab>/disclaimer' or '<tab>/fields/<field>/<property>'.`,
  };
}

export async function calcConfigRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /api/calc-config (public) ─────────────────────────────────────────

  fastify.get(
    '/',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await dbGet<Record<string, unknown>>(ROOT);
        reply.header('Cache-Control', 'public, max-age=5, stale-while-revalidate=30');
        return reply.status(200).send(data ?? {});
      } catch (err) {
        req.log.error({ err }, 'Failed to fetch calculator config');
        return reply.status(500).send({ error: 'Could not load calculator config.' });
      }
    },
  );

  // ── PATCH /api/calc-config (calc JWT) ─────────────────────────────────────
  //
  // Single-field update. Writes the field and an audit entry atomically via
  // dbMultiUpdate, same as content.ts's PATCH /api/content.

  fastify.patch(
    '/',
    {
      schema:     calcConfigPatchSchema,
      preHandler: [(fastify as any).verifyCalcConfig],
      config:     { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (
      req:   FastifyRequest<{ Body: { key: string; value: PatchValue } }>,
      reply: FastifyReply,
    ) => {
      const { key, value } = req.body;

      // Sanitise: prevent path traversal and empty paths (mirrors content.ts)
      const safeKey = key.replace(/\.\./g, '').replace(/^\/+/, '').trim();
      const check = validateKey(safeKey);
      if (!check.valid) {
        return reply.status(400).send({ error: check.error });
      }
      if (typeof value !== check.expectedType) {
        return reply.status(400).send({
          error: `Value for '${safeKey}' must be of type ${check.expectedType}, got ${typeof value}.`,
        });
      }

      try {
        const auditKey = `audit/calcConfig/${Date.now()}`;
        await dbMultiUpdate({
          [`public/${ROOT}/${safeKey}`]: value,
          [`public/${auditKey}`]: {
            key:      safeKey,
            value,
            calcId:   req.calcPayload?.id ?? 'calc',
            at:       new Date().toISOString(),
          },
        });

        req.log.info({ key: safeKey, value }, 'Calculator config field updated');
        return reply.status(200).send({ ok: true, key: safeKey, value, at: new Date().toISOString() });
      } catch (err) {
        req.log.error({ err, key: safeKey }, 'Failed to update calculator config');
        return reply.status(500).send({ error: 'Could not save calculator config.' });
      }
    },
  );

  // ── PUT /api/calc-config (calc JWT) — full-tree replace ───────────────────
  //
  // Used by "Apply JSON" and "Reset to Defaults" in the admin settings panel,
  // where the whole tree changes at once rather than one field.

  fastify.put(
    '/',
    {
      preHandler: [(fastify as any).verifyCalcConfig],
      config:     { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as Record<string, unknown>;

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Body must be a calculator config object.' });
      }

      const tabs = Object.keys(body);
      const invalidTabs = tabs.filter((t) => !VALID_TABS.has(t));
      if (invalidTabs.length > 0) {
        return reply.status(400).send({ error: `Unknown tab(s): ${invalidTabs.join(', ')}` });
      }

      try {
        const auditKey = `audit/calcConfig/${Date.now()}`;
        await dbMultiUpdate({
          [`public/${ROOT}`]: body,
          [`public/${auditKey}`]: {
            key:      'ALL',
            tabCount: tabs.length,
            calcId:   req.calcPayload?.id ?? 'calc',
            at:       new Date().toISOString(),
          },
        });

        req.log.info({ tabCount: tabs.length }, 'Calculator config replaced (full tree)');
        return reply.status(200).send({ ok: true, tabCount: tabs.length, at: new Date().toISOString() });
      } catch (err) {
        req.log.error({ err }, 'Failed to replace calculator config');
        return reply.status(500).send({ error: 'Could not save calculator config.' });
      }
    },
  );
}
