#!/usr/bin/env tsx
/**
 * scripts/emails.ts
 *
 * Live integration test — sends REAL emails through the SendGrid pipeline.
 * Run manually from each environment to verify end-to-end delivery:
 *
 *   Local:    cd server && npm run test:email
 *   Staging:  ssh into staging, cd to project, npm run test:email
 *   Prod:     (run from Vercel CLI or a one-off function)
 *
 * What it does:
 *   1. Sends a general inquiry  → firm inbox (or TEST_EMAIL_RECIPIENT)
 *   2. Sends a priority inquiry → firm inbox (or TEST_EMAIL_RECIPIENT)
 *   3. Both trigger a client confirmation → michael@lowenstein.ca
 *      (or TEST_EMAIL_RECIPIENT if set)
 *
 * What it does NOT do:
 *   - This is NOT in the automated test suite (`npm test`).
 *   - It never runs in CI. It's a manual smoke test.
 *
 * Environment behaviour:
 *   ┌─────────────────────┬──────────────────────────────────────────────────┐
 *   │ Environment         │ What happens                                    │
 *   ├─────────────────────┼──────────────────────────────────────────────────┤
 *   │ localhost            │ EMAIL_SANDBOX=true by default — SendGrid        │
 *   │                     │ validates the request but never delivers.       │
 *   │                     │ Set EMAIL_SANDBOX=false + TEST_EMAIL_RECIPIENT  │
 *   │                     │ in .env to actually receive the test email.     │
 *   ├─────────────────────┼──────────────────────────────────────────────────┤
 *   │ staging.fl-legal.ca │ TEST_EMAIL_RECIPIENT redirects all mail to      │
 *   │                     │ your test inbox. Real delivery, safe target.    │
 *   ├─────────────────────┼──────────────────────────────────────────────────┤
 *   │ fl-legal.ca (prod)  │ No sandbox, no redirect — mail goes to          │
 *   │                     │ FIRM_EMAIL and the test client address.         │
 *   │                     │ Only run this when you're ready to verify.      │
 *   └─────────────────────┴──────────────────────────────────────────────────┘
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { config } from '../src/config';
import { sendGeneralInquiry, sendPriorityInquiry } from '../src/services/mailer';

// ── Test recipient for the client confirmation ───────────────────────────────
// In production this actually goes to the "client" email address.
// In staging/local, TEST_EMAIL_RECIPIENT overrides it inside send().
const TEST_CLIENT_EMAIL = 'michael@lowenstein.ca';

// ── Helpers ──────────────────────────────────────────────────────────────────

function envLabel(): string {
  if (config.isProd)  return 'PRODUCTION (fl-legal.ca)';
  if (config.isStage) return 'STAGING (staging.fl-legal.ca)';
  return 'LOCAL (localhost)';
}

function divider(): void {
  console.log('\n' + '─'.repeat(60));
}

async function runTest(
  label: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  process.stdout.write(`  ${label}... `);
  try {
    await fn();
    console.log('✅ sent');
    return true;
  } catch (err: any) {
    console.log('❌ FAILED');
    console.error(`     ${err.message ?? err}`);
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const timestamp = new Date().toLocaleString('en-CA', {
    timeZone: 'America/Edmonton',
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  console.log('\n📧  SendGrid Email Smoke Test');
  divider();
  console.log(`  Environment:      ${envLabel()}`);
  console.log(`  NODE_ENV:         ${config.nodeEnv}`);
  console.log(`  From:             ${config.email.fromEmail}`);
  console.log(`  Firm inbox:       ${config.email.firmEmail}`);
  console.log(`  Sandbox mode:     ${config.email.sandbox ? 'ON (no delivery)' : 'OFF (real delivery)'}`);
  console.log(`  TEST_RECIPIENT:   ${config.email.testRecipient || '(not set — using real addresses)'}`);
  console.log(`  Client test addr: ${TEST_CLIENT_EMAIL}`);
  console.log(`  Timestamp:        ${timestamp}`);
  divider();

  if (config.email.sandbox) {
    console.log('\n  ⚠  Sandbox mode is ON — SendGrid will validate the request');
    console.log('     but will NOT actually deliver any email.');
    console.log('     To send real mail, set EMAIL_SANDBOX=false in your .env\n');
  }

  let passed = 0;
  let failed = 0;

  // ── Test 1: General inquiry ──────────────────────────────────────────────
  const t1 = await runTest(
    'General inquiry → firm + confirmation → client',
    () => sendGeneralInquiry({
      name:    'Smoke Test (General)',
      email:   TEST_CLIENT_EMAIL,
      phone:   '(403) 555-0199',
      message: `Automated smoke test from ${envLabel()} at ${timestamp}.\n\n`
             + 'This email verifies the SendGrid pipeline is working end-to-end. '
             + 'Both the firm-facing inquiry and the client confirmation should arrive.\n\n'
             + 'If you received this at a real inbox and did not intend to run the '
             + 'smoke test, check that TEST_EMAIL_RECIPIENT is set in your .env.',
    }),
  );
  t1 ? passed++ : failed++;

  // ── Test 2: Priority inquiry ─────────────────────────────────────────────
  const t2 = await runTest(
    'Priority inquiry → firm + confirmation → client',
    () => sendPriorityInquiry({
      name:         'Smoke Test (Priority)',
      email:        TEST_CLIENT_EMAIL,
      phone:        '(403) 555-0199',
      practiceArea: 'Real Estate Law',
      message:      `Priority smoke test from ${envLabel()} at ${timestamp}.\n\n`
                  + 'This verifies the ★ PRIORITY subject prefix, practice area badge, '
                  + 'and client confirmation all render correctly.',
    }),
  );
  t2 ? passed++ : failed++;

  // ── Summary ──────────────────────────────────────────────────────────────
  divider();
  console.log(`\n  Results: ${passed} passed, ${failed} failed`);

  if (failed === 0 && !config.email.sandbox) {
    console.log('\n  ✅ All emails sent successfully.');
    console.log('     Check the following inboxes for delivery:');
    const target = config.email.testRecipient || config.email.firmEmail;
    console.log(`       Firm-facing (×2):       ${target}`);
    console.log(`       Client confirmation (×2): ${config.email.testRecipient || TEST_CLIENT_EMAIL}`);
  } else if (failed === 0 && config.email.sandbox) {
    console.log('\n  ✅ All requests validated by SendGrid (sandbox — no actual delivery).');
    console.log('     To verify real delivery, set EMAIL_SANDBOX=false and re-run.');
  } else {
    console.log('\n  ❌ Some emails failed. Check the error messages above.');
    console.log('     Common causes:');
    console.log('       • SENDGRID_API_KEY missing or wrong');
    console.log('       • API key lacks Mail Send permission');
    console.log('       • fl-legal.ca domain not authenticated in SendGrid');
    console.log('       • EMAIL_FROM address not verified');
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main();