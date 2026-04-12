import * as dotenv from 'dotenv';
dotenv.config();

/**
 * src/api.ts — FL Legal API
 *
 * Fastify application.  Route map:
 * 
 * Features:
 *   • HTTPS via cert/local/ (dev) or cert/stage/ (staging) — auto-selected
 *     by NODE_ENV; override with TLS_CERT / TLS_KEY env vars.
 *     Set HTTPS=false to run plain HTTP (e.g. behind a reverse proxy).
 *
 *   • GET /api          — serves public/index.html (API landing page)
 *   • GET /api/docs     — Swagger UI (interactive API docs)

 *
 *   POST   /api/auth/editor              secretary password → editor JWT
 *   POST   /api/auth/lawyer              Firebase ID token  → lawyer JWT
 *   POST   /api/auth/lawyer/password     username+password  → lawyer JWT
 *
 *   GET    /api/content                  fetch all site content  (public)
 *   GET    /api/content/:section         fetch one section       (public)
 *   PATCH  /api/content                  update a content field  (editor JWT)
 *
 *   GET    /api/blog                     list blog posts  (public)
 *   GET    /api/blog/:id                 single post      (public)
 *   POST   /api/blog                     create post      (editor JWT)
 *   PATCH  /api/blog/:id                 update post      (editor JWT)
 *   DELETE /api/blog/:id                 delete post      (editor JWT)
 *
 *   POST   /api/inquiries                general appointment request (public)
 *   POST   /api/inquiries/priority       priority inquiry            (public)
 *
 *   GET    /api/calendar                 list events  (lawyer JWT)
 *   GT    /api/calendar/:id             one event    (lawyer JWT)
 *   POST   /api/calendar                 create event (lawyer JWT)
 *   PATCH  /api/calendar/:id             update event (lawyer JWT)
 *   DELETE /api/calendar/:id             delete event (lawyer JWT)
 *
 *   GET    /health                       liveness check
 */

import fs from 'fs';
import path from 'path';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import staticFiles from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { ServerOptions } from 'https';
import Fastify, { FastifyServerOptions } from 'fastify';

import { config } from '@config';
import authPlugin from '@plugins/auth';
import { authRoutes } from '@routes/auth';
import { blogRoutes } from '@routes/blog';
import { profileRoutes } from '@routes/profile';
import { contentRoutes } from '@routes/content';
import { inquiryRoutes } from '@routes/inquiry';
import { calendarRoutes } from '@routes/calendar';
import { initFirebase } from '@services/firebase';

// ─── TLS helper ───────────────────────────────────────────────────────────────
//
// Mirrors the old Express tryLoad() pattern:
//   • Required files (cert, key) throw if absent — fail fast with a clear message.
//   • Optional files (chain, pfx) soft-fail and return undefined.

function tryLoad(filePath: string, label: string): Buffer | undefined {
  if (!filePath) return undefined;
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.warn(`[TLS] Optional file not found, skipping: ${resolved} (${label})`);
    return undefined;
  }
  return fs.readFileSync(resolved);
}

function loadTls(): { https: ServerOptions } | Record<string, never> {
  if (!config.https.enabled) return {};

  const certPath = path.resolve(config.https.certFile);
  const keyPath  = path.resolve(config.https.keyFile);

  if (!fs.existsSync(certPath)) {
    throw new Error(
      `[TLS] Certificate not found: ${certPath}\n` +
      `      Set HTTPS=false or correct TLS_CERT in .env`,
    );
  }
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `[TLS] Key not found: ${keyPath}\n` +
      `      Set HTTPS=false or correct TLS_KEY in .env`,
    );
  }

  return {
    https: {
      cert: fs.readFileSync(certPath),
      key:  fs.readFileSync(keyPath),
      // Optional — only included when the env vars are set and files exist
      ca:   tryLoad(config.https.chainFile, 'SSLCHAIN'),
      pfx:  tryLoad(config.https.pfxFile,   'SSLPFX'),
    },
  };
}

async function main() {
  initFirebase();

  const tlsOptions = loadTls();
  const protocol = config.https.enabled ? 'https' : 'http';

  const serverOptions: FastifyServerOptions = {
    ...tlsOptions,
    logger: {
      level: config.isDev ? 'debug' : 'info',
      ...(config.isDev ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
    },
    ajv: {
      customOptions: { strict: false },
    },
  };

  const fastify = Fastify(serverOptions);

  // ── Swagger — register BEFORE routes so all schemas are collected ─────────

  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title:       'FL Legal API',
        description: 'REST API for Fric, Lowenstein & Co. LLP website',
        version:     '3.0.0',
        contact: {
          name:  'Michael Lowenstein',
          email: 'michael@lowenstein.ca',
        },
      },
      servers: [
        {
          url:         `${protocol}://localhost:${config.port}`,
          description: config.isDev   ? 'Local (development)'
                     : config.isStage ? 'Staging'
                     :                  'Production',
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type:         'http',
            scheme:       'bearer',
            bearerFormat: 'JWT',
            description:
              'Editor JWT  → POST /api/auth/editor\n' +
              'Lawyer JWT  → POST /api/auth/lawyer/password',
          },
        },
      },
      tags: [
        { name: 'Auth',     description: 'Authentication — obtain JWTs'            },
        { name: 'Content',  description: 'Site content read / edit'                },
        { name: 'Profile',  description: 'Site profiles read'                      },
        { name: 'Blog',     description: 'Blog posts'                              },
        { name: 'Inquiry',  description: 'Client inquiry emails'                   },
        { name: 'Calendar', description: 'Firm calendar (lawyer access only)'      },
        { name: 'Health',   description: 'Liveness probe'                          },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion:    'list',
      deepLinking:     true,
      tryItOutEnabled: true,
    },
    staticCSP:          true,
    transformStaticCSP: (header) => header,
    logo: {
      type:    'image/svg+xml',
      content: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="#b8932a" stroke-width="1.5">
           <path stroke-linecap="round" stroke-linejoin="round"
             d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0
                2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291
                0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62
                10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0
                01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703
                -.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377
                3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.59 1.202a5.989
                5.989 0 01-2.031.352 5.989 5.989 0
                01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z"/>
         </svg>`,
      ).toString('base64'),
    },
  });

  // ── Security ─────────────────────────────────────────────────────────────

  await fastify.register(helmet, {
    // Swagger UI needs inline scripts/styles
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'"],
        styleSrc:    ["'self'", "'unsafe-inline'"],
        imgSrc:      ["'self'", 'data:', 'validator.swagger.io'],
        connectSrc:  ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // ── CORS — stage-switched origin list (mirrors old Express pattern) ───────

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow no-origin requests (curl, Postman, same-origin SSR)
      if (!origin) return cb(null, true);
      // Exact match against the allowed origins array
      if (config.cors.allowedOrigins.includes(origin)) return cb(null, true);
      // In dev, also allow any localhost regardless of port
      if (config.isDev && origin.match(/^https?:\/\/localhost(:\d+)?$/)) {
        return cb(null, true);
      }
      cb(new Error(`Origin '${origin}' not permitted by CORS policy`), false);
    },
    methods:        ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials:    true,
  });

  // ── Rate limiting ────────────────────────────────────────────────────────

  await fastify.register(rateLimit, {
    max:        200,
    timeWindow: '1 minute',
    keyGenerator: (req) =>
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0].trim() ?? req.ip,
  });

  // ── Static files — public/ directory (favicon, images, etc.) ─────────────

  await fastify.register(staticFiles, {
    root:   path.resolve('public'),
    prefix: '/public/',
    index:  false,   // index.html served manually via GET /api below
  });

  // ── JWT auth decorators (verifyEditor / verifyLawyer) ─────────────────────

  await fastify.register(authPlugin);

  // ── Landing page — GET /api ───────────────────────────────────────────────
  //
  // Serves public/index.html.  Supports four runtime placeholders:
  //   {{PORT}}      current port
  //   {{ENV}}       NODE_ENV value
  //   {{PROTOCOL}}  http or https
  //   {{DOCS_URL}}  full URL to Swagger UI
  //
  // Falls back to an in-memory branded page when the file doesn't exist yet.

  fastify.get('/api', async (_req, reply) => {
    const indexPath = path.resolve('public', 'index.html');

    if (!fs.existsSync(indexPath)) {
      return reply.type('text/html').send(fallbackHtml(protocol));
    }

    const html = fs.readFileSync(indexPath, 'utf8')
      .replace(/\{\{PORT\}\}/g,     String(config.port))
      .replace(/\{\{ENV\}\}/g,      config.nodeEnv)
      .replace(/\{\{PROTOCOL\}\}/g, protocol)
      .replace(/\{\{DOCS_URL\}\}/g, `${protocol}://localhost:${config.port}/api/docs`);

    return reply.type('text/html').send(html);
  });

  // ── Health check ─────────────────────────────────────────────────────────

  fastify.get(
    '/health',
    {
      schema: {
        tags:    ['Health'],
        summary: 'Liveness probe',
        response: {
          200: {
            type: 'object',
            properties: {
              ok:       { type: 'boolean' },
              env:      { type: 'string'  },
              protocol: { type: 'string'  },
              ts:       { type: 'string'  },
            },
          },
        },
      },
    },
    async (_req, reply) =>
      reply.status(200).send({
        ok:       true,
        env:      config.nodeEnv,
        protocol,
        ts:       new Date().toISOString(),
      }),
  );

  // ── API routes ────────────────────────────────────────────────────────────

  fastify.register(authRoutes,     { prefix: '/api/auth'      });
  fastify.register(profileRoutes,  { prefix: '/api/profiles'   });
  fastify.register(contentRoutes,  { prefix: '/api/content'   });
  fastify.register(blogRoutes,     { prefix: '/api/blog'      });
  fastify.register(calendarRoutes, { prefix: '/api/calendar'  });
  fastify.register(inquiryRoutes,  { prefix: '/api/inquiries' });

  // ── Start ─────────────────────────────────────────────────────────────────

  try {
    await fastify.listen({ port: config.port, host: config.host });

    const base = `${protocol}://localhost:${config.port}`;
    fastify.log.info('');
    fastify.log.info('  ✓ FL Legal API');
    fastify.log.info(`    env      : ${config.nodeEnv}`);
    fastify.log.info(`    base     : ${base}/api`);
    fastify.log.info(`    docs     : ${base}/api/docs`);
    fastify.log.info(`    health   : ${base}/health`);
    fastify.log.info(
      config.https.enabled
        ? `    tls      : ${config.https.certFile}` +
          (config.https.chainFile ? `  +chain` : '') +
          (config.https.pfxFile   ? `  +pfx`   : '')
        : '    tls      : disabled (HTTP)',
    );
    fastify.log.info('');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// ─── Fallback landing page (when public/index.html is absent) ─────────────────

function fallbackHtml(protocol: string): string {
  const base     = `${protocol}://localhost:${config.port}`;
  const docsUrl  = `${base}/api/docs`;
  const healthUrl = `${base}/health`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>FL Legal API — ${config.nodeEnv}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', serif;
      background: #0f2235;
      color: #f5f0e8;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .card {
      background: #1a3a5c;
      border-radius: 16px;
      padding: 3rem;
      max-width: 540px;
      width: 100%;
      box-shadow: 0 8px 40px rgba(0,0,0,.45);
    }
    .badge {
      display: inline-block;
      background: #b8932a;
      color: #0f2235;
      font-family: sans-serif;
      font-size: .68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .12em;
      padding: 3px 12px;
      border-radius: 999px;
      margin-bottom: 1.5rem;
    }
    h1 { color: #b8932a; font-size: 1.8rem; font-weight: 600; line-height: 1.2; }
    .sub {
      font-family: sans-serif;
      font-size: .72rem;
      text-transform: uppercase;
      letter-spacing: .14em;
      color: rgba(255,255,255,.35);
      margin: .35rem 0 2rem;
    }
    p {
      font-size: .95rem;
      line-height: 1.75;
      color: rgba(255,255,255,.65);
      margin-bottom: 1rem;
    }
    code {
      background: rgba(0,0,0,.35);
      padding: 1px 7px;
      border-radius: 4px;
      font-size: .88em;
      font-family: monospace;
    }
    .links {
      background: rgba(0,0,0,.25);
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
      margin-top: 1.75rem;
    }
    .links-label {
      font-family: sans-serif;
      font-size: .68rem;
      text-transform: uppercase;
      letter-spacing: .1em;
      color: rgba(255,255,255,.3);
      margin-bottom: .75rem;
    }
    a {
      display: flex;
      align-items: center;
      gap: .5rem;
      color: #b8932a;
      text-decoration: none;
      font-family: sans-serif;
      font-size: .9rem;
      padding: .3rem 0;
      transition: color .15s;
    }
    a:hover { color: #d4ab40; text-decoration: underline; }
    .env-row {
      margin-top: 1.5rem;
      display: flex;
      gap: .75rem;
      flex-wrap: wrap;
    }
    .env-pill {
      font-family: sans-serif;
      font-size: .72rem;
      color: rgba(255,255,255,.45);
      background: rgba(0,0,0,.2);
      border: 1px solid rgba(255,255,255,.08);
      padding: 3px 10px;
      border-radius: 999px;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">${config.nodeEnv}</span>
    <h1>Fric, Lowenstein &amp; Co.</h1>
    <p class="sub">Barristers &amp; Solicitors — REST API</p>

    <p>
      This server provides the backend API for the firm website.
      All API endpoints are prefixed with <code>/api</code>.
    </p>
    <p>
      To replace this page, create <code>public/index.html</code> in the
      project root. Use <code>{{PORT}}</code>, <code>{{ENV}}</code>,
      <code>{{PROTOCOL}}</code> and <code>{{DOCS_URL}}</code> as
      runtime placeholders.
    </p>

    <div class="links">
      <div class="links-label">Quick links</div>
      <a href="${docsUrl}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b8932a" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        Swagger API Docs
      </a>
      <a href="${healthUrl}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b8932a" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Health check
      </a>
    </div>

    <div class="env-row">
      <span class="env-pill">port&nbsp;${config.port}</span>
      <span class="env-pill">${protocol.toUpperCase()}</span>
      <span class="env-pill">${config.https.enabled ? 'TLS on' : 'TLS off'}</span>
    </div>
  </div>
</body>
</html>`;
}

main();