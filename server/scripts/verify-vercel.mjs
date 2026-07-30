#!/usr/bin/env node
/**
 * scripts/verify-vercel.mjs
 *
 * Simulates the exact Vercel serverless runtime locally.
 *
 * What this does differently from `npm run local`:
 *   ┌──────────────────────────┬────────────────────┬─────────────────────┐
 *   │                          │ npm run local      │ This script         │
 *   ├──────────────────────────┼────────────────────┼─────────────────────┤
 *   │ Source                   │ Raw .ts files       │ Bundled api/index.js│
 *   │ Path aliases (@config…)  │ tsconfig-paths      │ Already resolved    │
 *   │ Env vars                 │ .env + hash.env…    │ Explicit only       │
 *   │ Body handling            │ Fastify parses raw  │ Pre-parsed → JSON   │
 *   │ TLS                      │ Self-signed cert    │ Plain HTTP          │
 *   │ Firebase credential      │ JSON file on disk   │ Base64 env var      │
 *   └──────────────────────────┴────────────────────┴─────────────────────┘
 *
 * Usage:
 *   cd server
 *   node scripts/verify-vercel.mjs              # build + test
 *   node scripts/verify-vercel.mjs --skip-build  # reuse existing bundle
 *   node scripts/verify-vercel.mjs --env staging  # simulate staging tier
 *
 * Prerequisites:
 *   - server/hash.env, server/resend.env, server/.env must exist locally
 *   - Firebase service account JSON file must exist locally
 *   - npm ci must have been run in server/
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(SERVER_ROOT, '..');
const BUNDLE_PATH = resolve(REPO_ROOT, 'api', 'index.js');

// ── Parse CLI args ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const envTier = args.includes('--env')
  ? args[args.indexOf('--env') + 1] || 'staging'
  : 'staging';

// ── Colours ──────────────────────────────────────────────────────────────────

const R = '\x1b[31m';
const G = '\x1b[32m';
const Y = '\x1b[33m';
const C = '\x1b[36m';
const B = '\x1b[1m';
const W = '\x1b[0m';
const DIM = '\x1b[2m';

function pass(msg) { console.log(`  ${G}✓${W} ${msg}`); }
function fail(msg) { console.log(`  ${R}✗${W} ${msg}`); }
function info(msg) { console.log(`  ${DIM}${msg}${W}`); }
function header(msg) { console.log(`\n${B}${C}── ${msg} ──${W}`); }

// ── Step 1: Load env vars from local files (simulating Vercel dashboard) ─────

header('Step 1: Loading environment variables');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const vars = {};
  readFileSync(filePath, 'utf8').split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq === -1) return;
    vars[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  });
  return vars;
}

const dotEnv = loadEnvFile(resolve(SERVER_ROOT, '.env'));
const hashEnv = loadEnvFile(resolve(SERVER_ROOT, 'hash.env'));
const resendEnv = loadEnvFile(resolve(SERVER_ROOT, 'resend.env'));

// Find the Firebase service account file
const fbPath = dotEnv.FIREBASE_SERVICE_ACCOUNT_PATH
  || './friclowenstein-firebase-adminsdk.json';
const fbResolved = resolve(SERVER_ROOT, fbPath);

if (!existsSync(fbResolved)) {
  fail(`Firebase service account not found: ${fbResolved}`);
  process.exit(1);
}

// Base64-encode it — exactly as Vercel would receive it
const fbBase64 = readFileSync(fbResolved).toString('base64');

// ── Wipe process.env of anything that might leak from the local shell ────────
// This is the key difference: on Vercel, .env files don't exist.
// We set ONLY what would be in the Vercel dashboard.

const VERCEL_ENV = {
  // Core
  NODE_ENV:       envTier === 'production' ? 'production' : 'staging',
  HTTPS:          'false',   // Vercel handles TLS at edge
  PORT:           '3333',    // Doesn't matter for inject() but config reads it

  // Auth
  JWT_SECRET:     hashEnv.JWT_SECRET,
  ADMIN_HASH:     hashEnv.ADMIN_HASH,
  EDITOR_HASH:    hashEnv.EDITOR_HASH,
  CALC_HASH:      hashEnv.CALC_HASH,

  // Firebase
  FIREBASE_DATABASE_URL:        dotEnv.FIREBASE_DATABASE_URL,
  FIREBASE_SERVICE_ACCOUNT_JSON: fbBase64,
  // Deliberately NOT setting FIREBASE_SERVICE_ACCOUNT_PATH — Vercel doesn't have the file

  // Email
  RESEND_API_KEY:      resendEnv.RESEND_API_KEY,
  FIRM_EMAIL:          dotEnv.FIRM_EMAIL || 'friclow@gmail.com',
  EMAIL_FROM:          dotEnv.EMAIL_FROM || 'no-reply@fl-legal.ca',
  EMAIL_REPLY_TO:      dotEnv.EMAIL_REPLY_TO || 'friclow@gmail.com',
  TEST_EMAIL_RECIPIENT: dotEnv.TEST_EMAIL_RECIPIENT || 'test@fl-legal.ca',
};

// Validate all required vars are present
const REQUIRED = [
  'JWT_SECRET', 'ADMIN_HASH', 'EDITOR_HASH', 'CALC_HASH',
  'RESEND_API_KEY', 'FIRM_EMAIL', 'FIREBASE_DATABASE_URL',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
];

let missingVars = false;
for (const key of REQUIRED) {
  if (!VERCEL_ENV[key]) {
    fail(`Missing: ${key} — check your .env / hash.env / resend.env files`);
    missingVars = true;
  } else {
    pass(`${key} = ${key.includes('SECRET') || key.includes('HASH') || key.includes('KEY') || key.includes('JSON')
      ? VERCEL_ENV[key].slice(0, 8) + '...'
      : VERCEL_ENV[key]}`);
  }
}

if (missingVars) {
  console.log(`\n${R}Cannot continue — fix missing env vars above.${W}\n`);
  process.exit(1);
}

// ── Step 2: Build the bundle ─────────────────────────────────────────────────

header('Step 2: Building API bundle');

if (skipBuild) {
  info('--skip-build flag set, reusing existing bundle');
} else {
  try {
    console.log(`  Building...`);
    execSync('node scripts/build-api.mjs', { cwd: SERVER_ROOT, stdio: 'inherit' });
    pass('Bundle built successfully');
  } catch {
    fail('esbuild failed — see errors above');
    process.exit(1);
  }
}

if (!existsSync(BUNDLE_PATH)) {
  fail(`Bundle not found at ${BUNDLE_PATH}`);
  process.exit(1);
}

// Verify no leaked aliases
const bundleContent = readFileSync(BUNDLE_PATH, 'utf8');
const leakedAliases = bundleContent.match(/require\(["']@(config|schema|routes|services|plugins)/g);
if (leakedAliases) {
  fail(`Bundle contains unresolved aliases: ${leakedAliases.join(', ')}`);
  process.exit(1);
}
pass('No leaked @alias imports in bundle');

const bundleSize = (readFileSync(BUNDLE_PATH).length / 1024).toFixed(1);
info(`Bundle size: ${bundleSize} KB`);

// ── Step 3: Nuke process.env and inject ONLY Vercel vars ─────────────────────

header('Step 3: Simulating Vercel environment');

// Clear ALL existing env vars that could leak local config
for (const key of Object.keys(process.env)) {
  if (key === 'PATH' || key === 'HOME' || key === 'USER' || key === 'SHELL'
    || key === 'TERM' || key === 'LANG' || key === 'NODE_PATH'
    || key.startsWith('npm_') || key.startsWith('NVM_')) continue;
  delete process.env[key];
}

// Set exactly what Vercel would have
for (const [key, value] of Object.entries(VERCEL_ENV)) {
  process.env[key] = value;
}

pass(`Injected ${Object.keys(VERCEL_ENV).length} env vars (Vercel simulation)`);
info(`NODE_ENV = ${process.env.NODE_ENV}`);
info(`HTTPS = ${process.env.HTTPS}`);
info(`FIREBASE_SERVICE_ACCOUNT_JSON = ${process.env.FIREBASE_SERVICE_ACCOUNT_JSON.slice(0, 20)}...`);

// ── Step 4: Load the bundled handler ─────────────────────────────────────────

header('Step 4: Loading bundled handler');

let handler;
try {
  // Clear the require cache so we get a fresh load with our env vars
  delete require.cache[BUNDLE_PATH];
  const mod = require(BUNDLE_PATH);
  handler = mod.default || mod;

  if (typeof handler !== 'function') {
    fail(`Bundle default export is ${typeof handler}, expected function`);
    process.exit(1);
  }
  pass('Handler loaded — cold start succeeded');
} catch (err) {
  fail(`Cold start CRASHED: ${err.message}`);
  console.error(`\n${R}${err.stack}${W}\n`);
  console.log(`${Y}This is exactly what happens on Vercel.${W}`);
  console.log(`${Y}Fix the error above, rebuild, and re-run.${W}\n`);
  process.exit(1);
}

// ── Step 5: Start a local HTTP server using the handler ──────────────────────

header('Step 5: Starting local Vercel simulation server');

const PORT = 3939;

const server = createServer(async (req, res) => {
  // Simulate Vercel's body pre-parsing
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    try {
      req.body = raw ? JSON.parse(raw) : undefined;
    } catch {
      req.body = raw;
    }
  }
  await handler(req, res);
});

await new Promise((resolve) => server.listen(PORT, resolve));
pass(`Server listening on http://localhost:${PORT}`);

const BASE = `http://localhost:${PORT}`;

// ── Step 6: Run smoke tests ──────────────────────────────────────────────────

header('Step 6: Running smoke tests');

let passed = 0;
let failed = 0;
const results = [];

async function test(label, method, path, opts = {}) {
  const url = `${BASE}${path}`;
  const fetchOpts = {
    method,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  };
  if (opts.body) fetchOpts.body = JSON.stringify(opts.body);

  try {
    const res = await fetch(url, fetchOpts);
    const status = res.status;
    let body;
    try { body = await res.json(); } catch { body = await res.text().catch(() => ''); }

    const ok = opts.expect
      ? opts.expect(status, body)
      : status >= 200 && status < 400;

    if (ok) {
      pass(`${label} → ${G}${status}${W}`);
      passed++;
    } else {
      fail(`${label} → ${R}${status}${W}`);
      if (body && typeof body === 'object') info(JSON.stringify(body).slice(0, 200));
      failed++;
    }
    results.push({ label, status, ok });
    return { status, body };
  } catch (err) {
    fail(`${label} → ${R}NETWORK ERROR: ${err.message}${W}`);
    failed++;
    results.push({ label, status: 0, ok: false });
    return { status: 0, body: null };
  }
}

// ── 6.1: Health ──────────────────────────────────────────────────────────────

await test('GET /api/health', 'GET', '/api/health',
  { expect: (s, b) => s === 200 && b?.ok === true });

// ── 6.2: Public content ──────────────────────────────────────────────────────

await test('GET /api/content (public)', 'GET', '/api/content',
  { expect: (s) => s === 200 });

await test('GET /api/content/home (section)', 'GET', '/api/content/home',
  { expect: (s) => s === 200 });

// ── 6.3: Calc config (public read) ──────────────────────────────────────────

await test('GET /api/calc-config/ (public)', 'GET', '/api/calc-config/',
  { expect: (s) => s === 200 });

// ── 6.4: Blog (public) ──────────────────────────────────────────────────────

await test('GET /api/blog (public)', 'GET', '/api/blog',
  { expect: (s) => s === 200 });

// ── 6.5: Calendar (public read) ─────────────────────────────────────────────

// await test('GET /api/calendar (public)', 'GET', '/api/calendar',
//   { expect: (s) => s === 200 });

// ── 6.6: Auth — editor login (wrong password → 401) ─────────────────────────

await test('POST /api/auth/editor (bad password → 401)', 'POST', '/api/auth/editor',
  { body: { password: 'wrong-password-on-purpose' },
    expect: (s) => s === 401 });

// ── 6.7: Auth — calc login (wrong password → 401) ───────────────────────────

await test('POST /api/auth/calc (bad password → 401)', 'POST', '/api/auth/calc',
  { body: { password: 'wrong-password-on-purpose' },
    expect: (s) => s === 401 });

// ── 6.8: Content patch without auth (→ 401) ─────────────────────────────────

await test('PATCH /api/content (no auth → 401)', 'PATCH', '/api/content',
  { body: { key: 'home/header', value: 'test' },
    expect: (s) => s === 401 });

// ── 6.9: Calc config write without auth (→ 401) ─────────────────────────────

await test('PUT /api/calc-config/ (no auth → 401)', 'PUT', '/api/calc-config/',
  { body: {},
    expect: (s) => s === 401 });

// ── 6.10: Inquiry submission (POST body handling) ────────────────────────────

await test('POST /api/inquiries (valid body)', 'POST', '/api/inquiries',
  { body: {
      name: 'Vercel Simulation Test',
      email: 'test@fl-legal.ca',
      message: 'Automated test from verify-vercel.mjs — safe to ignore.'
    },
    expect: (s) => s === 200 || s === 204 });

// ── 6.11: Inquiry validation (missing required fields → 400) ─────────────────

await test('POST /api/inquiries (empty body → 400)', 'POST', '/api/inquiries',
  { body: {},
    expect: (s) => s === 400 });

// ── 6.12: Priority inquiry ───────────────────────────────────────────────────

await test('POST /api/inquiries/priority (valid body)', 'POST', '/api/inquiries/priority',
  { body: {
      name: 'Priority Simulation Test',
      email: 'test@fl-legal.ca',
      message: 'Priority test from verify-vercel.mjs.',
      practiceArea: 'Other'
    },
    expect: (s) => s === 200 || s === 204 });

// ── 6.13: Profiles (public) ─────────────────────────────────────────────────

await test('GET /api/profiles (public)', 'GET', '/api/profiles',
  { expect: (s) => s === 200 });

// ── 6.14: 404 on unknown route ──────────────────────────────────────────────

await test('GET /api/nonexistent (→ 404)', 'GET', '/api/this-does-not-exist',
  { expect: (s) => s === 404 });

// ── Results ──────────────────────────────────────────────────────────────────

header('Results');

console.log(`\n  ${G}${passed} passed${W}  ${failed > 0 ? `${R}${failed} failed${W}` : ''}\n`);

if (failed === 0) {
  console.log(`  ${G}${B}All tests passed.${W}`);
  console.log(`  ${DIM}The bundled API function works identically to what Vercel will run.${W}`);
  console.log(`  ${DIM}Deploy with confidence: vercel deploy${W}\n`);
} else {
  console.log(`  ${R}${B}${failed} test(s) failed.${W}`);
  console.log(`  ${Y}Fix the failures above BEFORE deploying.${W}`);
  console.log(`  ${DIM}These same failures will occur on Vercel.${W}\n`);
}

server.close();
process.exit(failed > 0 ? 1 : 0);
