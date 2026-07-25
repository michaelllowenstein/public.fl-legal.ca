import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';

process.env.NODE_ENV = 'test';
process.env.HTTPS = 'false';
process.env.JWT_SECRET = 'unit-test-secret';
process.env.CALC_HASH = '$2b$10$ABCDEFGHIJKLMNOPQRSTUO9fR0Q2hZJw5orF0pErPiL4k4uOQve';
process.env.EDITOR_HASH = '$2b$10$ABCDEFGHIJKLMNOPQRSTUO9fR0Q2hZJw5orF0pErPiL4k4uOQve';
process.env.ADMIN_HASH = '$2b$10$ABCDEFGHIJKLMNOPQRSTUO9fR0Q2hZJw5orF0pErPiL4k4uOQve';
process.env.FIREBASE_DATABASE_URL = 'https://example.test';
process.env.SENDGRID_API_KEY = 'SG.unit-test-key';
process.env.FIRM_EMAIL = 'firm@example.test';

// ── Module-scope refs populated in before() ──────────────────────────────────

let authPlugin: any;
let signCalcToken: (...args: any[]) => string;
let signEditorToken: (...args: any[]) => string;
let signLawyerToken: (...args: any[]) => string;

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);

  app.get('/editor', { preHandler: [app.verifyEditor] }, async (req) => ({
    role: req.editorPayload?.role,
  }));
  app.get('/calc', { preHandler: [app.verifyCalcConfig] }, async (req) => ({
    role: req.calcPayload?.role,
  }));
  app.get('/lawyer', { preHandler: [app.verifyLawyer] }, async (req) => ({
    role: req.lawyerPayload?.role,
    uid: req.lawyerPayload?.uid,
  }));

  await app.ready();
  return app;
}

describe('auth plugin', () => {
  before(async () => {
    const authModule = await import('../src/plugins/auth');
    authPlugin = authModule.default;
    signCalcToken = authModule.signCalcToken;
    signEditorToken = authModule.signEditorToken;
    signLawyerToken = authModule.signLawyerToken;
  });

  it('rejects missing bearer tokens', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/editor' });
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.json(), { error: 'Authentication required.' });
    } finally {
      await app.close();
    }
  });

  it('accepts matching role tokens and decorates the request', async () => {
    const app = await buildApp();
    try {
      const editor = await app.inject({
        method: 'GET',
        url: '/editor',
        headers: { authorization: `Bearer ${signEditorToken('secretary')}` },
      });
      assert.equal(editor.statusCode, 200);
      assert.deepEqual(editor.json(), { role: 'editor' });

      const calc = await app.inject({
        method: 'GET',
        url: '/calc',
        headers: { authorization: `Bearer ${signCalcToken('calculator')}` },
      });
      assert.equal(calc.statusCode, 200);
      assert.deepEqual(calc.json(), { role: 'calc' });

      const lawyer = await app.inject({
        method: 'GET',
        url: '/lawyer',
        headers: { authorization: `Bearer ${signLawyerToken('lawyer-1', 'lawyer@example.test')}` },
      });
      assert.equal(lawyer.statusCode, 200);
      assert.deepEqual(lawyer.json(), { role: 'lawyer', uid: 'lawyer-1' });
    } finally {
      await app.close();
    }
  });

  it('rejects valid tokens with the wrong role', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/editor',
        headers: { authorization: `Bearer ${signCalcToken()}` },
      });
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.json(), { error: 'Editor access required.' });
    } finally {
      await app.close();
    }
  });

  it('rejects malformed tokens', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/calc',
        headers: { authorization: 'Bearer not-a-jwt' },
      });
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.json(), { error: 'Invalid or expired token.' });
    } finally {
      await app.close();
    }
  });
});