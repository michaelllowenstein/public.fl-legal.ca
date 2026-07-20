import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Fastify from 'fastify';

process.env.NODE_ENV = 'test';
process.env.HTTPS = 'false';
process.env.JWT_SECRET = 'unit-test-secret';
process.env.CALC_HASH = '$2b$10$ABCDEFGHIJKLMNOPQRSTUO9fR0Q2hZJw5orF0pErPiL4k4uOQve';
process.env.EDITOR_HASH = '$2b$10$ABCDEFGHIJKLMNOPQRSTUO9fR0Q2hZJw5orF0pErPiL4k4uOQve';
process.env.ADMIN_HASH = '$2b$10$ABCDEFGHIJKLMNOPQRSTUO9fR0Q2hZJw5orF0pErPiL4k4uOQve';
process.env.FIREBASE_DATABASE_URL = 'https://example.test';
process.env.SMTP_USER = 'unit@example.test';
process.env.SMTP_PASS = 'unit-pass';
process.env.FIRM_EMAIL = 'firm@example.test';

const authModule = await import('../src/plugins/auth');
const authPlugin = authModule.default;
const { signCalcToken, signEditorToken } = authModule;
const calcRouteModule = await import('../src/routes/calc-config');
const { CALC_CONFIG_DB_PATH, VALID_CALC_TABS, calcConfigRoutes, isValidConfig } = calcRouteModule;

function validConfig(): Record<string, unknown> {
  return Object.fromEntries(
    [...VALID_CALC_TABS].map((tab) => [
      tab,
      {
        fields: {
          legalFee: { included: true, taxable: true, label: 'Legal fee', default: 1000 },
        },
        disclaimer: `${tab} disclaimer`,
      },
    ]),
  );
}

async function buildApp(options: {
  stored?: Record<string, unknown> | null;
  updates?: Record<string, unknown>[];
  failGet?: boolean;
  failWrite?: boolean;
} = {}) {
  const app = Fastify({ logger: false });
  const updates = options.updates ?? [];

  await app.register(authPlugin);
  await app.register(
    async (instance) => calcConfigRoutes(instance, {
      get: async () => {
        if (options.failGet) throw new Error('read failed');
        return options.stored ?? null;
      },
      multiUpdate: async (update) => {
        if (options.failWrite) throw new Error('write failed');
        updates.push(update);
      },
      now: () => 1234567890,
    }),
    { prefix: '/api/calc-config' },
  );

  await app.ready();
  return { app, updates };
}

describe('calculator config route validation', () => {
  it('requires all known calculator tabs', () => {
    const body = validConfig();
    assert.equal(isValidConfig(body), true);

    delete body.sale;
    assert.equal(isValidConfig(body), false);
  });

  it('rejects unknown tabs and malformed tab payloads', () => {
    assert.equal(isValidConfig({ ...validConfig(), unknown: { fields: {}, disclaimer: '' } }), false);
    assert.equal(isValidConfig({ ...validConfig(), sale: { fields: {}, disclaimer: 42 } }), false);
    assert.equal(isValidConfig([]), false);
  });
});

describe('calculator config routes', () => {
  it('serves calculator config publicly with short cache headers', async () => {
    const stored = validConfig();
    const { app } = await buildApp({ stored });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/calc-config/' });
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['cache-control'], 'public, max-age=5, stale-while-revalidate=30');
      assert.deepEqual(res.json(), stored);
    } finally {
      await app.close();
    }
  });

  it('returns an empty object when no remote calculator config exists', async () => {
    const { app } = await buildApp({ stored: null });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/calc-config/' });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), {});
    } finally {
      await app.close();
    }
  });

  it('requires calculator auth for writes', async () => {
    const { app } = await buildApp();
    try {
      const missing = await app.inject({
        method: 'PUT',
        url: '/api/calc-config/',
        payload: validConfig(),
      });
      assert.equal(missing.statusCode, 401);

      const editor = await app.inject({
        method: 'PUT',
        url: '/api/calc-config/',
        headers: { authorization: `Bearer ${signEditorToken()}` },
        payload: validConfig(),
      });
      assert.equal(editor.statusCode, 403);
      assert.deepEqual(editor.json(), { error: 'Calculator config access required.' });
    } finally {
      await app.close();
    }
  });

  it('rejects invalid write payloads before touching storage', async () => {
    const updates: Record<string, unknown>[] = [];
    const { app } = await buildApp({ updates });
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/calc-config/',
        headers: { authorization: `Bearer ${signCalcToken()}` },
        payload: { sale: { fields: {}, disclaimer: '' } },
      });
      assert.equal(res.statusCode, 400);
      assert.equal(updates.length, 0);
    } finally {
      await app.close();
    }
  });

  it('writes valid config and an audit entry atomically', async () => {
    const updates: Record<string, unknown>[] = [];
    const body = validConfig();
    const { app } = await buildApp({ updates });
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/calc-config/',
        headers: { authorization: `Bearer ${signCalcToken('calc-admin')}` },
        payload: body,
      });
      assert.equal(res.statusCode, 204);
      assert.equal(updates.length, 1);
      assert.deepEqual(updates[0][CALC_CONFIG_DB_PATH], body);
      const audit = updates[0]['public/audit/calcConfig/1234567890'] as {
        action?: string;
        at?: string;
      };
      assert.equal(audit.action, 'calc-config-update');
      assert.match(String(audit.at), /^\d{4}-\d{2}-\d{2}T/);
    } finally {
      await app.close();
    }
  });
});
