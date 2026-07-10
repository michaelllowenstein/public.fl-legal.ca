/**
 * routes/calc-config.ts
 *
 * GET  /api/calc-config   — current calculator configuration (public)
 * PUT  /api/calc-config   — replace calculator configuration  (editor JWT required)
 *
 * Reads and writes target `public/calcConfig` in Firebase RTDB.
 * The entire config tree is small (~4 KB) so reads and writes are always
 * whole-object — no per-field PATCH needed.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { dbGet, dbMultiUpdate } from '../services/firebase';

const DB_PATH = 'public/calcConfig';

/** The six tab keys the calculator recognises — anything else is rejected. */
const VALID_TABS = new Set([
  'purchase-mortgage',
  'cash-purchase',
  'sale',
  'refinance',
  'wills',
  'incorporation',
]);

function isValidConfig(body: unknown): body is Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return false;
  }

  const obj = body as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!VALID_TABS.has(key)) return false;
    const tab = obj[key];
    if (typeof tab !== 'object' || tab === null) return false;

    const t = tab as Record<string, unknown>;
    if (typeof t.fields !== 'object' || t.fields === null) return false;
    if (typeof t.disclaimer !== 'string') return false;
  }

  for (const expected of VALID_TABS) {
    if (!(expected in obj)) return false;
  }

  return true;
}

export async function calcConfigRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /api/calc-config ─────────────────────────────────────────────────
  fastify.get(
    '/',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await dbGet<Record<string, unknown>>(DB_PATH);
        reply.header('Cache-Control', 'public, max-age=5, stale-while-revalidate=30');
        return reply.status(200).send(data ?? {});
      } catch (err) {
        req.log.error({ err }, 'Failed to fetch calculator config');
        return reply.status(500).send({ error: 'Could not load calculator configuration.' });
      }
    },
  );

  // ── PUT /api/calc-config ─────────────────────────────────────────────────
  fastify.put(
    '/',
    {
      preHandler: [(fastify as any).verifyEditor],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body;

      if (!isValidConfig(body)) {
        return reply.status(400).send({
          error:
            'Invalid calculator config. Expected an object with all six tab keys, ' +
            'each containing { fields: {…}, disclaimer: string }.',
        });
      }

      try {
        await dbMultiUpdate({
          [DB_PATH]: body,
          [`public/audit/calcConfig/${Date.now()}`]: {
            action: 'calc-config-update',
            at: new Date().toISOString(),
          },
        });

        req.log.info('Calculator config updated');
        return reply.status(204).send();
      } catch (err) {
        req.log.error({ err }, 'Failed to update calculator config');
        return reply.status(500).send({ error: 'Could not save calculator configuration.' });
      }
    },
  );
}