#!/usr/bin/env node
// Demo-data cleanup CLI — WP-11.5 (G.19). Resets upstream artefacts between
// recording takes so previous issues/messages/tasks don't bleed across takes.
// Idempotent. Safe to re-run.
//
//   node scripts/cleanup-demo-data.mjs           # live
//   node scripts/cleanup-demo-data.mjs --dry-run # report-only
//
// Reads env from .env.local first, then process.env:
//   required: GITHUB_PAT, SLACK_BOT_TOKEN, SF_LOGIN_URL, SF_CLIENT_ID, SF_CLIENT_SECRET
//   optional: DEMO_GH_REPO, DEMO_SLACK_CHANNEL, DEMO_SF_ACCOUNT, DEMO_CLEANUP_HOURS

import { readFileSync } from 'node:fs';

const DEFAULTS = {
  repo: 'mboss37/semantic-gps-sandbox',
  slackChannel: '#general',
  sfAccount: 'Edge Communications',
  windowHours: 24,
};

const DRY_RUN = process.argv.includes('--dry-run');

const parseDotenv = (path) => {
  const env = {};
  let raw;
  try { raw = readFileSync(path, 'utf8'); } catch { return env; }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
};

const localEnv = parseDotenv('.env.local');
const readEnv = (name) => process.env[name] ?? localEnv[name];
const requireEnv = (name) => {
  const v = readEnv(name);
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
};
const logPlan = (msg) => console.log(DRY_RUN ? `[dry-run] ${msg}` : msg);
const readHours = () => {
  const raw = readEnv('DEMO_CLEANUP_HOURS');
  if (raw === undefined) return DEFAULTS.windowHours;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULTS.windowHours;
};

// GitHub — close every OPEN issue on the sandbox repo. PAT auth + the
// required User-Agent header (missing it returns 403 from api.github.com).
const cleanupGithub = async () => {
  const pat = requireEnv('GITHUB_PAT');
  const repo = readEnv('DEMO_GH_REPO') ?? DEFAULTS.repo;
  const [owner, name] = repo.split('/');
  if (!owner || !name) throw new Error(`DEMO_GH_REPO must be "owner/repo", got "${repo}"`);
  const headers = {
    authorization: `Bearer ${pat}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'semantic-gps-cleanup',
  };

  // No window filter on GitHub — closes EVERY open issue on the sandbox repo
  // by design. This is a recording-day reset, not a maintenance pass.
  console.log(`[github] scanning open issues on ${repo}...`);
  const q = encodeURIComponent(`is:issue is:open repo:${repo}`);
  const res = await fetch(`https://api.github.com/search/issues?q=${q}&per_page=100`, { headers });
  if (!res.ok) throw new Error(`github search failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const numbers = (Array.isArray(data.items) ? data.items : [])
    .map((i) => i.number).filter((n) => typeof n === 'number');
  if (numbers.length === 0) { console.log('[github] no open issues — nothing to do'); return; }

  const closed = [];
  for (const num of numbers) {
    if (DRY_RUN) { logPlan(`would close issue #${num}`); closed.push(num); continue; }
    const r = await fetch(`https://api.github.com/repos/${owner}/${name}/issues/${num}`, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }),
    });
    if (!r.ok) { console.warn(`[github] failed to close #${num}: ${r.status}`); continue; }
    closed.push(num);
  }
  console.log(`[github] closed ${closed.length} issues (${closed.map((n) => `#${n}`).join(', ') || 'none'})`);
};

// Slack — delete bot-posted messages in the demo channel within the window.
// auth.test returns bot user_id + bot_id for filtering. chat.delete needs
// `chat:write`; if missing, Slack returns `cant_delete_message` — warn + continue.
const slackCall = async (token, method, body) => {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`slack ${method} http ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(`slack ${method} error: ${data.error ?? 'unknown'}`);
  return data;
};

const cleanupSlack = async () => {
  const token = requireEnv('SLACK_BOT_TOKEN');
  const channel = readEnv('DEMO_SLACK_CHANNEL') ?? DEFAULTS.slackChannel;
  const hours = readHours();

  const identity = await slackCall(token, 'auth.test', {});
  const botUserId = identity.user_id;
  const botId = identity.bot_id;

  console.log(`[slack] scanning last ${hours}h of messages in ${channel}...`);
  const oldest = (Date.now() / 1000 - hours * 3600).toFixed(6);
  const history = await slackCall(token, 'conversations.history', { channel, oldest, limit: 100 });
  const mine = (Array.isArray(history.messages) ? history.messages : [])
    .filter((m) => m.user === botUserId || (botId && m.bot_id === botId));
  if (mine.length === 0) { console.log('[slack] no bot messages in window — nothing to do'); return; }

  let deleted = 0;
  for (const msg of mine) {
    if (DRY_RUN) { logPlan(`would delete ts=${msg.ts}`); deleted += 1; continue; }
    try { await slackCall(token, 'chat.delete', { channel, ts: msg.ts }); deleted += 1; }
    catch (e) { console.warn(`[slack] failed to delete ts=${msg.ts}: ${e.message}`); }
  }
  console.log(`[slack] deleted ${deleted} bot messages`);
};

// Salesforce — OAuth client-credentials, then delete recent Tasks on the demo
// Account. Window-scoped via CreatedDate LAST_N_HOURS so we never touch older
// records than this recording session.
const sfMintToken = async () => {
  const loginUrl = requireEnv('SF_LOGIN_URL').replace(/\/+$/, '');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: requireEnv('SF_CLIENT_ID'),
    client_secret: requireEnv('SF_CLIENT_SECRET'),
  });
  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`salesforce token mint failed: ${res.status}`);
  const data = await res.json();
  return { token: data.access_token, instance: data.instance_url };
};

const cleanupSalesforce = async () => {
  const account = readEnv('DEMO_SF_ACCOUNT') ?? DEFAULTS.sfAccount;
  const hours = readHours();
  const { token, instance } = await sfMintToken();
  const base = `${instance.replace(/\/+$/, '')}/services/data/v60.0`;
  const authHeader = { authorization: `Bearer ${token}`, accept: 'application/json' };

  console.log(`[salesforce] scanning recent demo tasks on ${account}...`);
  // SOQL escape: `\` FIRST, then `'` — matches lib/mcp/proxy-salesforce.ts soqlEscape.
  const sfEscape = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const soql = `SELECT Id FROM Task WHERE WhatId IN (SELECT Id FROM Account WHERE Name = '${sfEscape(account)}') AND CreatedDate = LAST_N_HOURS:${hours}`;
  const qRes = await fetch(`${base}/query?q=${encodeURIComponent(soql)}`, { headers: authHeader });
  if (!qRes.ok) throw new Error(`salesforce query failed: ${qRes.status}`);
  const qData = await qRes.json();
  const records = Array.isArray(qData.records) ? qData.records : [];
  if (records.length === 0) { console.log('[salesforce] no recent tasks — nothing to do'); return; }

  const deleted = [];
  for (const rec of records) {
    if (DRY_RUN) { logPlan(`would delete Task ${rec.Id}`); deleted.push(rec.Id); continue; }
    const r = await fetch(`${base}/sobjects/Task/${rec.Id}`, { method: 'DELETE', headers: authHeader });
    if (!r.ok) { console.warn(`[salesforce] failed to delete ${rec.Id}: ${r.status}`); continue; }
    deleted.push(rec.Id);
  }
  console.log(`[salesforce] deleted ${deleted.length} tasks (${deleted.join(', ') || 'none'})`);
};

const subsystems = [
  ['github', cleanupGithub],
  ['slack', cleanupSlack],
  ['salesforce', cleanupSalesforce],
];

let hadFailure = false;
for (const [name, fn] of subsystems) {
  try { await fn(); }
  catch (e) {
    hadFailure = true;
    console.error(`[${name}] failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
console.log(hadFailure ? 'cleanup finished with errors.' : 'cleanup complete.');
process.exit(hadFailure ? 1 : 0);
