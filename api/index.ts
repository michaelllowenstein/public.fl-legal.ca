/**
 * api/index.ts  —  Vercel Serverless Function entry point
 *
 * This file lives at the PROJECT ROOT (not inside server/src/).
 * Vercel treats any file under /api/ as a serverless function.
 *
 * It imports your existing Fastify app and adapts it to the
 * Vercel/Node.js HTTP handler interface using @fastify/express-compatibility
 * or, more simply, by calling fastify.inject() which converts
 * a raw IncomingMessage/ServerResponse pair into a Fastify request.
 *
 * Key differences from local dev:
 *   • HTTPS=false     — Vercel handles TLS at the edge
 *   • No TLS cert files needed
 *   • No port binding — Vercel provides the HTTP server
 *   • CORS origin must include your production domain
 *   • Cold start: Fastify is rebuilt on first request (~200ms)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Fastify from 'fastify';
import cors      from '@fastify/cors';
import helmet    from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import authPlugin        from '../server/src/plugins/auth';
import { authRoutes }    from '../server/src/routes/auth';
import { contentRoutes } from '../server/src/routes/content';
import { blogRoutes }    from '../server/src/routes/blog';
import { inquiryRoutes } from '../server/src/routes/inquiry';
import { profileRoutes } from '../server/src/routes/profile';
import { logRoutes }     from '../server/src/routes/logs';
import { calendarRoutes } from '../server/src/routes/calendar';
import { initFirebase }  from '../server/src/services/firebase';
import { notificationsRoutes } from '../server/src/routes/notifications';
import { calcConfigRoutes } from '../server/src/routes/calc-config';
import { config }        from '../server/src/config/index';

// ── Fastify instance — cached across warm Vercel invocations ─────────────────

let _app: ReturnType<typeof Fastify> | null = null;

async function getApp() {
  if (_app) return _app;

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
        'https://staging.fl-legal.ca'
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
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials:    true,
  });

  await fastify.register(rateLimit, {
    max:        200,
    timeWindow: '1 minute',
    keyGenerator: (req) =>
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0].trim() ?? req.ip ?? 'unknown',
  });

  await fastify.register(authPlugin);

  fastify.get('/api/health', async (_req, reply) =>
    reply.send({ ok: true, ts: new Date().toISOString() })
  );

  fastify.register(authRoutes,                { prefix: '/api/auth'      });
  fastify.register(contentRoutes,             { prefix: '/api/content'   });
  fastify.register(blogRoutes,                { prefix: '/api/blog'      });
  fastify.register(inquiryRoutes,             { prefix: '/api/inquiries' });
  fastify.register(profileRoutes,             { prefix: '/api/profiles'  });
  fastify.register(calendarRoutes,            { prefix: '/api/calendar'  });
  fastify.register(logRoutes,                 { prefix: '/api/logs'      });
  fastify.register(notificationsRoutes,       { prefix: '/api/notifications'});
  fastify.register(calcConfigRoutes,          { prefix: '/api/calc-config'});

  await fastify.ready();
  _app = fastify;
  return fastify;
}

// ── Vercel handler ────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();

  // Use the promise form of inject() — avoids the callback type collision
  // between Fastify's LightMyRequestResponse and VercelResponse.
  const result = await app.inject({
    method:  (req.method ?? 'GET') as any,
    url:     req.url ?? '/',
    headers: req.headers as Record<string, string>,
    payload: req,
  });

  // Forward all headers from Fastify's response
  Object.entries(result.headers).forEach(([key, value]) => {
    if (value !== undefined) res.setHeader(key, value as string);
  });

  res.status(result.statusCode).send(result.rawPayload);
}