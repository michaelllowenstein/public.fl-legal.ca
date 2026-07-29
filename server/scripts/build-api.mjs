#!/usr/bin/env node
/**
 * scripts/build-api.mjs
 *
 * Bundles server/src/vercel-entry.ts → api/index.js
 *
 * This resolves all TypeScript path aliases (@config, @routes/*, etc.) at
 * build time so the output is a plain CJS file with only bare npm imports
 * left — exactly what Vercel's @vercel/nft file tracer can follow.
 *
 * npm packages are kept external (`packages: 'external'`) because Vercel
 * installs them from the root package.json at deploy time.
 *
 * Run:
 *   node scripts/build-api.mjs          (from the server/ directory)
 *   cd server && node scripts/build-api.mjs  (from the repo root)
 */

import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/ root (one level up from scripts/)
const serverRoot = path.resolve(__dirname, '..');
// repo root (one level up from server/)
const repoRoot = path.resolve(serverRoot, '..');
// server source directory
const serverSrc = path.join(serverRoot, 'src');

// ── Path alias plugin ─────────────────────────────────────────────────────────
//
// Mirrors the paths from server/tsconfig.json so esbuild can resolve:
//   @config        → server/src/config/index.ts
//   @schema        → server/src/schema/index.ts
//   @schema/*      → server/src/schema/*
//   @routes/*      → server/src/routes/*
//   @plugins/*     → server/src/plugins/*
//   @services/*    → server/src/services/*
//   @middleware/*   → server/src/middleware/*

const aliasPlugin = {
  name: 'server-path-aliases',
  setup(build) {
    // Exact-match aliases (no wildcard)
    const exact = {
      '@config': path.join(serverSrc, 'config', 'index.ts'),
      '@schema': path.join(serverSrc, 'schema', 'index.ts'),
    };

    // Prefix aliases (wildcard: @prefix/foo → serverSrc/prefix/foo)
    const prefixes = ['schema', 'routes', 'plugins', 'services', 'middleware'];

    build.onResolve({ filter: /^@/ }, (args) => {
      // 1. Try exact match
      if (exact[args.path]) {
        return { path: exact[args.path] };
      }

      // 2. Try prefix match (@routes/auth → src/routes/auth)
      const match = args.path.match(/^@(\w+)\/(.+)$/);
      if (match && prefixes.includes(match[1])) {
        return { path: path.join(serverSrc, match[1], match[2]) };
      }

      // 3. Not one of our aliases — let esbuild resolve normally
      return undefined;
    });
  },
};

// ── Build ─────────────────────────────────────────────────────────────────────

console.log('');
console.log('🔧 Bundling Vercel API function');
console.log(`   entry:  server/src/vercel-entry.ts`);
console.log(`   output: api/index.js`);
console.log('');

const t0 = Date.now();

await build({
  entryPoints: [path.join(serverSrc, 'vercel-entry.ts')],
  outfile: path.join(repoRoot, 'api', 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  // Mark all bare npm imports as external — Vercel installs them at deploy
  packages: 'external',
  plugins: [aliasPlugin],
  resolveExtensions: ['.ts', '.js', '.json'],
  sourcemap: false,
  minify: false,
  // Silence warnings about __dirname being overridden in CJS output
  logLevel: 'warning',
  // Ensure dotenv.config() calls are harmless on Vercel
  // (they silently no-op when .env files don't exist)
  define: {},
});

console.log(`✅ api/index.js bundled in ${Date.now() - t0}ms`);
console.log('');
