#!/usr/bin/env node
/**
 * Check Firecrawl credits and email owner@example.com via Resend
 * when remaining credits drop below 20%, 10%, or 5% of plan.
 *
 * Usage:
 *   node scripts/check-credits.mjs          # check + notify if thresholds hit
 *   node scripts/check-credits.mjs --dry-run # check only, no email
 *
 * Cron (daily at 9am): 0 9 * * * cd /path/to/project && node scripts/check-credits.mjs
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const env = dotenv.parse(fs.readFileSync(envPath, 'utf8'));

const FIRECRAWL_API_KEY = env.FIRECRAWL_API_KEY;
const RESEND_API_KEY = env.RESEND_API_KEY;
const NOTIFY_EMAIL = 'owner@example.com';
const ALERT_THRESHOLDS = [20, 10, 5]; // percentages

const isDryRun = process.argv.includes('--dry-run');

async function getFirecrawlCredits() {
  const res = await fetch('https://api.firecrawl.dev/v2/team/credit-usage', {
    headers: { 'Authorization': `Bearer ${FIRECRAWL_API_KEY}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { success, data } = await res.json();
  if (!success || !data) throw new Error('Invalid response');
  return data;
}

async function sendEmail(subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Crawli Alerts <onboarding@resend.dev>',
      to: NOTIFY_EMAIL,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend ${res.status}: ${err}`);
  }
  return res.json();
}

function getAlertLevel(pct) {
  if (pct <= 5) return 'critical';
  if (pct <= 10) return 'warning';
  if (pct <= 20) return 'heads-up';
  return null;
}

function buildEmail(remaining, planCredits, pct, level) {
  const levelLabel = { critical: '🚨 Critical', warning: '⚠️ Warning', 'heads-up': '📉 Heads-up' }[level];
  const barFilled = Math.round(pct / 5);
  const bar = '█'.repeat(barFilled) + '░'.repeat(20 - barFilled);

  return {
    subject: `${levelLabel}: Firecrawl credits at ${pct}%`,
    html: `
      <h2>${levelLabel}: Firecrawl credits at ${pct}%</h2>
      <p><strong>${remaining}</strong> of <strong>${planCredits}</strong> credits remaining.</p>
      <pre style="font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">[${bar}] ${pct}%</pre>
      <p><a href="https://dashboard.firecrawl.dev/usage">View dashboard</a> · <a href="https://firecrawl.dev/pricing">Top up credits</a></p>
    `,
  };
}

// --- Main ---

console.log('\n📊 Firecrawl Credit Check\n');

if (!FIRECRAWL_API_KEY) {
  console.error('❌ FIRECRAWL_API_KEY not set');
  process.exit(1);
}

let credits;
try {
  credits = await getFirecrawlCredits();
} catch (err) {
  console.error(`❌ Failed to fetch credits: ${err.message}`);
  process.exit(1);
}

const { remainingCredits, planCredits } = credits;
const pct = Math.round((remainingCredits / planCredits) * 100);
const level = getAlertLevel(pct);

console.log(`Remaining: ${remainingCredits}/${planCredits} credits (${pct}%)`);
console.log(`Used:      ${planCredits - remainingCredits}`);

const crossedThresholds = ALERT_THRESHOLDS.filter((t) => pct <= t);
if (crossedThresholds.length === 0) {
  console.log(`\n✅ No alerts — above all thresholds (${ALERT_THRESHOLDS.join('%, ')}%)`);
} else {
  console.log(`\n${level === 'critical' ? '🚨' : '⚠️ '} Below threshold: ${crossedThresholds.join('%, ')}%`);

  if (isDryRun) {
    console.log('--dry-run: skipping email');
  } else if (!RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not set — cannot send email');
  } else {
    const { subject, html } = buildEmail(remainingCredits, planCredits, pct, level);
    try {
      await sendEmail(subject, html);
      console.log(`✉️  Email sent to ${NOTIFY_EMAIL}`);
    } catch (err) {
      console.error(`❌ Email failed: ${err.message}`);
    }
  }
}
console.log();
