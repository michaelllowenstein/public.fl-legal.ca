/**
 * server/src/vercel-entry.ts — Vercel Serverless Function source
 *
 * This file is the SOURCE for the Vercel API handler. It lives inside
 * server/src/ so that esbuild can resolve all @alias path aliases using
 * the server's tsconfig paths — no tsconfig-paths runtime hack required.
 *
 * Build step (run by `scripts/build-api.mjs`):
 *   server/src/vercel-entry.ts  →  api/index.js
 *
 * Key differences from the local dev entry (src/api.ts):
 *   • No TLS / no port binding — Vercel handles networking
 *   • No Swagger UI / static files — not needed in serverless
 *   • Uses fastify.inject() to bridge VercelRequest → Fastify
 *   • Cold start: Fastify is built once, then cached across warm invocations
 */
 
import type { IncomingMessage, ServerResponse } from 'http';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
 
import { config } from '@config';
import authPlugin from '@plugins/auth';
import { authRoutes } from '@routes/auth';
import { contentRoutes } from '@routes/content';
import { blogRoutes } from '@routes/blog';
import { inquiryRoutes } from '@routes/inquiry';
import { profileRoutes } from '@routes/profile';
import { logRoutes } from '@routes/logs';
import { calendarRoutes } from '@routes/calendar';
import { notificationsRoutes } from '@routes/notifications';
import { calcConfigRoutes } from '@routes/calc-config';
import { initFirebase } from '@services/firebase';
 
// ── Fastify instance — cached across warm Vercel invocations ─────────────────
 
let _app: ReturnType<typeof Fastify> | null = null;
 
async function getApp() {
  if (_app) return _app;
 
  console.log('[vercel] Cold start — building Fastify instance');
 
  initFirebase();
 
  const fastify = Fastify({
    logger: false,
    ajv: { customOptions: { strict: false } },
  });
 
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
 
  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = [
        'https://localhost:4422',
        'https://fl-legal.ca',
        'https://www.fl-legal.ca',
        'https://staging.fl-legal.ca',
      ];
      if (
        allowed.includes(origin) ||
        /\.vercel\.app$/.test(origin) ||
        (config.isDev && /localhost/.test(origin))
      ) {
        return cb(null, true);
      }
      cb(new Error(`CORS blocked: ${origin}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
 
  await fastify.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (req) =>
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        .trim() ?? req.ip ?? 'unknown',
  });
 
  await fastify.register(authPlugin);
 
  fastify.get('/api/health', async (_req, reply) =>
    reply.send({ ok: true, ts: new Date().toISOString() }),
  );
 
  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(contentRoutes, { prefix: '/api/content' });
  fastify.register(blogRoutes, { prefix: '/api/blog' });
  fastify.register(inquiryRoutes, { prefix: '/api/inquiries' });
  fastify.register(profileRoutes, { prefix: '/api/profiles' });
  fastify.register(calendarRoutes, { prefix: '/api/calendar' });
  fastify.register(logRoutes, { prefix: '/api/logs' });
  fastify.register(notificationsRoutes, { prefix: '/api/notifications' });
  fastify.register(calcConfigRoutes, { prefix: '/api/calc-config' });
 
  await fastify.ready();
  _app = fastify;
 
  console.log('[vercel] Fastify ready');
  return fastify;
}
 
// ── Vercel handler ────────────────────────────────────────────────────────────
//
// Vercel expects a default export that receives (IncomingMessage, ServerResponse).
// We use fastify.inject() to bridge the two worlds.
//
// CRITICAL FIX: Vercel pre-parses the request body and puts it on `req.body`.
// The raw IncomingMessage stream is already consumed by the time our handler
// runs, so we must forward the PARSED body — not the raw stream — to inject().
 
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  try {
    const app = await getApp();
 
    // ── Serialise the body for inject() ─────────────────────────────────────
    //
    // fastify.inject() expects `payload` as a string, Buffer, or Stream.
    // Vercel has already parsed the body into req.body (object | string | undefined).
    // We JSON-serialise objects; strings pass through; empty bodies → undefined.
    let payload: string | undefined;
    if (req.body !== undefined && req.body !== null) {
      payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
 
    const result = await app.inject({
      method: (req.method ?? 'GET') as any,
      url: req.url ?? '/',
      headers: req.headers as Record<string, string>,
      payload,
    });
 
    // Forward all headers from Fastify's response
    for (const [key, value] of Object.entries(result.headers)) {
      if (value !== undefined) res.setHeader(key, value as string);
    }
 
    res.statusCode = result.statusCode;
    res.end(result.rawPayload);
  } catch (err: any) {
    console.error('[vercel] Unhandled error in handler:', err?.message ?? err);
    console.error('[vercel] Stack:', err?.stack ?? '(no stack)');
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}