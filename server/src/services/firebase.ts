/**
 * services/firebase.ts
 *
 * Firebase Admin SDK wrapper.
 *
 * IMPORTANT — schema root
 * ───────────────────────
 * All application data lives under the "public" root node in this database:
 *
 *   public/
 *     blog/           ← blog posts (post1, post2, …)
 *     nav/            ← members[], priceSections[]
 *     profiles/       ← bill, howard, anthony, tami, york, marc, bronwyn, tracy
 *     siteContent/    ← home, aboutUs, areasOfLaw, faq, pricing
 *
 * Every helper function in this file automatically prepends "public/" to the
 * path argument, so callers always use logical paths:
 *
 *   dbGet('siteContent/home')    → reads public/siteContent/home
 *   dbGet('blog/post1')          → reads public/blog/post1
 *   dbUpdate('blog/post1', {…})  → updates public/blog/post1
 */
import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

// ── Root node ─────────────────────────────────────────────────────────────────
//
// Change this constant if the Firebase export root ever changes.

const DB_ROOT = 'public';

function normalized(logicalPath: string): string {
  return `${DB_ROOT}/${logicalPath.replace(/^\/+/, '')}`;
}

// ── Initialization ────────────────────────────────────────────────────────────

export function initFirebase(): void {

  if (admin.apps.length > 0) return; // already initialised

  let credential: admin.credential.Credential;

  if (config.firebase.serviceAccountPath) {
    // Load from JSON file (preferred for local dev)
    const resolved = path.resolve(config.firebase.serviceAccountPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(
        `Firebase service account file not found: ${resolved}\n` +
        `Set FIREBASE_SERVICE_ACCOUNT_PATH in .env or provide inline env vars.`
      );
    }
    const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    credential = admin.credential.cert(serviceAccount);
  } else if (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) {
    // Inline env vars (preferred for production / CI)
    credential = admin.credential.cert({
      projectId:   config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey:  config.firebase.privateKey,
    });
  } else {
    throw new Error(
      'Firebase credentials not configured. ' +
      'Set FIREBASE_SERVICE_ACCOUNT_PATH or the three inline FIREBASE_* vars.'
    );
  }

  admin.initializeApp({
    credential,
    databaseURL: config.firebase.databaseUrl,
  });

  console.log('✓ Firebase Admin initialised');
}

// ---- Database accessor -------------------------------------------

let _db: admin.database.Database | null = null;

export function db(): admin.database.Database {
  if (!_db) _db = admin.database();
  return _db;
}

// ── CRUD helpers ──────────────────────────────────────────────────────────────

/** Read a logical path (auto-prefixed with /public). */
export async function dbGet<T = unknown>(logicalPath: string): Promise<T | null> {
  const snap = await db().ref(normalized(logicalPath)).once('value');
  return snap.exists() ? (snap.val() as T) : null;
}
 
/** Set (overwrite) a logical path. */
export async function dbSet(logicalPath: string, value: unknown): Promise<void> {
  await db().ref(normalized(logicalPath)).set(value);
}
 
/**
 * Shallow merge update at a logical path.
 * Keys in `value` are relative to `logicalPath`.
 * Use slash-separated keys for nested updates:
 *   dbUpdate('siteContent/home', { 'header': 'New heading' })
 */
export async function dbUpdate(
  logicalPath: string,
  value: Record<string, unknown>,
): Promise<void> {
  await db().ref(normalized(logicalPath)).update(value);
}
 
/** Push a new auto-keyed child and return its key. */
export async function dbPush(logicalPath: string, value: unknown): Promise<string> {
  const ref = await db().ref(normalized(logicalPath)).push(value);
  return ref.key!;
}
 
/** Remove a logical path. */
export async function dbRemove(logicalPath: string): Promise<void> {
  await db().ref(normalized(logicalPath)).remove();
}

/**
 * Multi-path update — writes multiple paths atomically.
 * Keys in the map are FULL paths from the database root (not prefixed).
 * Use this for cross-node writes that must succeed or fail together.
 *
 * Example:
 *   dbMultiUpdate({
 *     'public/siteContent/home/header': 'New heading',
 *     'public/audit/content/1234': { key: 'home/header', at: '…' },
 *   })
 */
export async function dbMultiUpdate(
  updates: Record<string, unknown>,
): Promise<void> {
  await db().ref('/').update(updates);
}
