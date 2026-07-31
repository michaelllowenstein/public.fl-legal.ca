#!/usr/bin/env tsx
/**
 * scripts/email-smoke-test.ts
 *
 * Live integration test — sends REAL emails through Resend.
 * Run manually: cd server && npm run test:email
 *
 * Before domain verification, set EMAIL_FROM=onboarding@resend.dev
 * in your .env. Resend's test sender can only deliver to the email
 * on your Resend account — safe by design, no sandbox toggle needed.
 */

import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '../server/resend.env', override: true });

import { config } from '../src/config';
import { sendGeneralInquiry, sendPriorityInquiry } from '../src/services/mailer';

const TEST_CLIENT_EMAIL = 'michael@lowenstein.ca';
const TEST_CLIENT_NAME = 'Michael Lowenstein';
const TEST_CLIENT_PHONE = '(825)-488-2533';

function envLabel(): string {
  if (config.isProd)  return 'PRODUCTION (fl-legal.ca)';
  if (config.isStage) return 'STAGING (staging.fl-legal.ca)';
  return 'LOCAL (localhost)';
}

function divider(): void {
  console.log('\n' + '\u2500'.repeat(60));
}

async function runTest(label: string, fn: () => Promise<void>): Promise<boolean> {
  process.stdout.write(`  ${label}... `);
  try {
    await fn();
    console.log('\u2705 sent');
    return true;
  } catch (err: any) {
    console.log('\u274C FAILED');
    console.error(`     ${err.message ?? err}`);
    return false;
  }
}

async function main(): Promise<void> {
  console.log(
    'Environment Variables Loaded:',
    JSON.parse(JSON.stringify(config))
  );

  const timestamp = new Date().toLocaleString('en-CA', {
    timeZone: 'America/Edmonton',
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  console.log('\n\uD83D\uDCE7  Resend Email Smoke Test');
  divider();
  console.log(`  Environment:      ${envLabel()}`);
  console.log(`  NODE_ENV:         ${config.nodeEnv}`);
  console.log(`  From:             ${config.email.fromEmail}`);
  console.log(`  Firm inbox:       ${config.email.firmEmail}`);
  console.log(`  TEST_RECIPIENT:   ${config.email.testRecipient || '(not set \u2014 using real addresses)'}`);
  console.log(`  Client test addr: ${TEST_CLIENT_EMAIL}`);
  console.log(`  Timestamp:        ${timestamp}`);
  divider();

  let passed = 0;
  let failed = 0;

  const t1 = await runTest(
    'General inquiry \u2192 firm + confirmation \u2192 client',
    () => sendGeneralInquiry({
      name:    `Smoke Test for ${TEST_CLIENT_NAME} (General)`,
      email:   TEST_CLIENT_EMAIL,
      phone:   TEST_CLIENT_PHONE,
      message: `Automated smoke test from ${envLabel()} at ${timestamp}.\n\n`
             + 'This email verifies the Resend pipeline is working end-to-end. '
             + 'Both the firm-facing inquiry and the client confirmation should arrive.',
    }),
  );
  t1 ? passed++ : failed++;

  const t2 = await runTest(
    'Priority inquiry \u2192 firm + confirmation \u2192 client',
    () => sendPriorityInquiry({
      name:         `Smoke Test for ${TEST_CLIENT_NAME} (Priority)`,
      email:        TEST_CLIENT_EMAIL,
      phone:        TEST_CLIENT_PHONE,
      practiceArea: 'Other',
      message:      `Priority smoke test from ${envLabel()} at ${timestamp}.\n\n`
                  + 'This verifies the \u2605 PRIORITY subject prefix, practice area badge, '
                  + 'and client confirmation all render correctly.',
    }),
  );
  t2 ? passed++ : failed++;

  divider();
  console.log(`\n  Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n  \u2705 All emails sent successfully.');
    console.log('     Check the following inboxes for delivery:');
    const target = config.email.testRecipient || config.email.firmEmail;
    console.log(`       Firm-facing (\u00d72):       ${target}`);
    console.log(`       Client confirmation (\u00d72): ${config.email.testRecipient || TEST_CLIENT_EMAIL}`);
  } else {
    console.log('\n  \u274C Some emails failed. Check the error messages above.');
    console.log('     Common causes:');
    console.log('       \u2022 RESEND_API_KEY missing or wrong');
    console.log('       \u2022 EMAIL_FROM domain not verified (use onboarding@resend.dev until then)');
    console.log('       \u2022 Sending to an address not on your Resend account (before domain verification)');
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main();