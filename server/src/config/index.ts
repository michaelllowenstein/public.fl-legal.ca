import * as dotenv from 'dotenv';
dotenv.config();

function require(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

// ── Environment tier ──────────────────────────────────────────────────────────
const nodeEnv = optional('NODE_ENV', 'development');
const isDev = nodeEnv === 'development';
const isStage = nodeEnv === 'staging';
const isProd = nodeEnv === 'production';

// ── CORS origin — stage-switched, matches your old Express pattern ────────────
//    local   → https://localhost:4200
//    staging → http://localhost:4200   (or override via ALLOWED_ORIGINS)
//    prod    → https://fl-legal.ca     (or override via ALLOWED_ORIGINS)
const defaultOrigins = isDev ? 'https://localhost:4422' : isStage ? 'https://localhost:4244' : 'https://fl-legal.ca';

// Default TLS cert/key paths based on environment tier.
// Can always be overridden via TLS_CERT / TLS_KEY env vars.
const defaultCert = isDev ? 'cert/local/localhost.crt' : isStage ? 'cert/stage/staging.cert' : ''; // production: provide TLS_CERT explicitly

const defaultKey = isDev ? 'cert/local/localhost.decrypted.key' : isStage ? 'cert/stage/staging.key' : ''; // production: provide TLS_KEY explicitly

export const config = {
  port: parseInt(optional('PORT', '3000'), 10),
  host: optional('HOSTNAME', '0.0.0.0'),
  nodeEnv,
  isDev,
  isStage,
  isProd,

  // ── TLS ───────────────────────────────────────────────────────────────────
  // Set HTTPS=false to run plain HTTP (e.g. behind a TLS-terminating proxy).
  // SSLCHAIN and SSLPFX are optional — soft-fail if absent (mirrors tryLoad).
  https: {
    enabled: optional('HTTPS', 'true') === 'true',
    certFile: optional('TLS_CERT', defaultCert),
    keyFile: optional('TLS_KEY', defaultKey),
    chainFile: optional('SSLCHAIN'), // optional CA chain
    pfxFile: optional('SSLPFX'), // optional PFX bundle
  },

  // ── CORS ──────────────────────────────────────────────────────────────────
  cors: {
    allowedOrigins: optional('ALLOWED_ORIGINS', defaultOrigins)
      .split(',')
      .map((o: string) => o.trim())
      .filter(Boolean),
  },

  auth: {
    jwtSecret: require('JWT_SECRET'),
    calcPasswordHash: require('CALC_HASH'),
    editorPasswordHash: require('EDITOR_HASH'),
    adminPasswordHash: require('ADMIN_HASH'),
    lawyerTokenExpiry: optional('LAWYER_TOKEN_EXPIRY', '8h'),
    editorTokenExpiry: optional('EDITOR_TOKEN_EXPIRY', '4h'),
    calcTokenExpiry: optional('EDITOR_TOKEN_EXPIRY', '4h'),
  },

  firebase: {
    // ── Credential priority (first match wins) ──────────────────────────────
    //   1. FIREBASE_SERVICE_ACCOUNT_JSON — base64-encoded full service account
    //      JSON blob. Most reliable on Vercel: no newline handling edge cases.
    //      Generate: base64 -i friclowenstein-firebase-adminsdk.json | tr -d '\n'
    //      Set that output as the FIREBASE_SERVICE_ACCOUNT_JSON env var on Vercel.
    //   2. FIREBASE_SERVICE_ACCOUNT_PATH — path to a local JSON file (local dev).
    //   3. Three inline vars (projectId, clientEmail, privateKey) — fallback.
    serviceAccountJson: optional('FIREBASE_SERVICE_ACCOUNT_JSON'),
    serviceAccountPath: optional('FIREBASE_SERVICE_ACCOUNT_PATH'),
    projectId: optional('FIREBASE_PROJECT_ID'),
    clientEmail: optional('FIREBASE_CLIENT_EMAIL'),
    privateKey: optional('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    databaseUrl: require('FIREBASE_DATABASE_URL'),
  },

  email: {
    host: optional('SMTP_HOST', 'smtp.gmail.com'),
    port: parseInt(optional('SMTP_PORT', '587'), 10),
    secure: optional('SMTP_SECURE', 'false') === 'true',
    user: require('SMTP_USER'),
    pass: require('SMTP_PASS'),
    firmEmail: require('FIRM_EMAIL'),
    fromName: optional('EMAIL_FROM_NAME', 'Fric, Lowenstein & Co. LLP'),
    replyTo: optional('EMAIL_REPLY_TO'),
  },
} as const;

export type Config = typeof config;
