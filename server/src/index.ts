import type { IncomingMessage, ServerResponse } from 'http';
import { config } from '../src/config';
import { initFirebase } from '../src/services/firebase';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import authPlugin from '../src/plugins/auth';
import { authRoutes } from '../src/routes/auth';
import { contentRoutes } from '../src/routes/content';
import { blogRoutes } from '../src/routes/blog';
import { inquiryRoutes } from '../src/routes/inquiry';
import { profileRoutes } from '../src/routes/profile';
import { logRoutes } from '../src/routes/logs';
import { calendarRoutes } from '../src/routes/calendar';
import { notificationsRoutes } from '../src/routes/notifications';
import { calcConfigRoutes } from '../src/routes/calc-config';

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
        'https://fl-legal.ca',
        'https://www.fl-legal.ca',
        'https://staging.fl-legal.ca',
        'https://localhost:4422',
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
        ?.split(',')[0].trim() ?? req.ip ?? 'unknown',
  });

  await fastify.register(authPlugin);

  fastify.get('/api/health', async (_req, reply) =>
    reply.send({ ok: true, ts: new Date().toISOString() }),
  );

  fastify.register(authRoutes,           { prefix: '/api/auth' });
  fastify.register(contentRoutes,        { prefix: '/api/content' });
  fastify.register(blogRoutes,           { prefix: '/api/blog' });
  fastify.register(inquiryRoutes,        { prefix: '/api/inquiries' });
  fastify.register(profileRoutes,        { prefix: '/api/profiles' });
  fastify.register(calendarRoutes,       { prefix: '/api/calendar' });
  fastify.register(logRoutes,            { prefix: '/api/logs' });
  fastify.register(notificationsRoutes,  { prefix: '/api/notifications' });
  fastify.register(calcConfigRoutes,     { prefix: '/api/calc-config' });

  await fastify.ready();
  _app = fastify;
  return fastify;
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  try {
    const app = await getApp();

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

    for (const [key, value] of Object.entries(result.headers)) {
      if (value !== undefined) res.setHeader(key, value as string);
    }

    res.statusCode = result.statusCode;
    res.end(result.rawPayload);
  } catch (err: any) {
    console.error('[vercel] Handler error:', err?.message, err?.stack);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

export const config_vercel = { maxDuration: 15 };