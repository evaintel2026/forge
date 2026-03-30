#!/usr/bin/env node
/**
 * Forge Browser Daemon — Nivel 2: browser persistente para QA sessions largas.
 *
 * Uso:
 *   node daemon.mjs start [--port=9400] [--headless=false]
 *   node daemon.mjs stop
 *   node daemon.mjs status
 *
 * El daemon mantiene un Chromium abierto con estado persistente (cookies, tabs, login).
 * Los comandos llegan via HTTP localhost. Auto-shutdown después de 30min idle.
 *
 * API:
 *   POST /command  { "cmd": "goto", "args": ["https://..."] }
 *   GET  /health   → { "status": "ok", "uptime": 123 }
 *   POST /stop     → shutdown graceful
 */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

const args = process.argv.slice(2);
const action = args[0];

const flags = {};
for (const arg of args) {
  if (arg.startsWith('--')) {
    const [key, val] = arg.slice(2).split('=');
    flags[key] = val ?? 'true';
  }
}

const STATE_FILE = resolve('.forge/.daemon-state.json');
const PORT = parseInt(flags.port || '9400');
const HEADLESS = flags.headless !== 'false';
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutos

// --- Actions ---

if (action === 'stop') {
  if (!existsSync(STATE_FILE)) {
    console.log('No daemon running.');
    process.exit(0);
  }
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  try {
    await fetch(`http://localhost:${state.port}/stop`, { method: 'POST', headers: { 'Authorization': `Bearer ${state.token}` } });
    console.log('Daemon stopped.');
  } catch {
    console.log('Daemon not reachable. Cleaning up state file.');
  }
  try { unlinkSync(STATE_FILE); } catch {}
  process.exit(0);
}

if (action === 'status') {
  if (!existsSync(STATE_FILE)) {
    console.log('No daemon running.');
    process.exit(0);
  }
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  try {
    const res = await fetch(`http://localhost:${state.port}/health`);
    const data = await res.json();
    console.log(`Daemon running on port ${state.port}`);
    console.log(`  PID: ${state.pid}`);
    console.log(`  Uptime: ${Math.round(data.uptime)}s`);
    console.log(`  Idle: ${Math.round(data.idle)}s`);
  } catch {
    console.log('Daemon state file exists but daemon not reachable.');
  }
  process.exit(0);
}

if (action !== 'start') {
  console.error('Usage: node daemon.mjs <start|stop|status>');
  process.exit(1);
}

// --- Start daemon ---

const token = randomUUID();
const startedAt = Date.now();
let lastActivity = Date.now();

console.log(`Starting forge browser daemon on port ${PORT}...`);

const browser = await chromium.launch({ headless: HEADLESS });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
});

let page = await context.newPage();
let refMap = new Map();

// --- Ref system ---
async function buildRefs(interactive = false) {
  const snapshot = await page.accessibility.snapshot({ interestingOnly: interactive });
  refMap = new Map();
  let counter = 1;

  function walk(node, depth = 0) {
    if (!node) return '';
    const ref = `@e${counter++}`;
    const indent = '  '.repeat(depth);
    refMap.set(ref, { role: node.role, name: node.name });
    let output = `${indent}${ref} [${node.role}]${node.name ? ` "${node.name}"` : ''}${node.value ? ` value="${node.value}"` : ''}\n`;
    if (node.children) for (const child of node.children) output += walk(child, depth + 1);
    return output;
  }
  return walk(snapshot);
}

async function resolveRef(refOrSelector) {
  if (refOrSelector.startsWith('@e')) {
    const entry = refMap.get(refOrSelector);
    if (!entry) throw new Error(`Ref ${refOrSelector} not found. Run 'snapshot' first.`);
    return page.getByRole(entry.role, { name: entry.name }).first();
  }
  return page.locator(refOrSelector).first();
}

// --- Command handler ---
async function handleCommand(cmd, cmdArgs = []) {
  lastActivity = Date.now();

  switch (cmd) {
    case 'goto':
      const response = await page.goto(cmdArgs[0], { waitUntil: 'domcontentloaded' });
      return `Navigated to ${cmdArgs[0]} — ${response?.status() || 'unknown'}`;

    case 'snapshot':
      return await buildRefs(cmdArgs.includes('-i'));

    case 'screenshot':
      await page.screenshot({ path: cmdArgs[0] || 'screenshot.png', fullPage: true });
      return `Screenshot saved: ${cmdArgs[0] || 'screenshot.png'}`;

    case 'click':
      const clickEl = await resolveRef(cmdArgs[0]);
      await clickEl.click();
      return `Clicked: ${cmdArgs[0]}`;

    case 'fill':
      const fillEl = await resolveRef(cmdArgs[0]);
      await fillEl.fill(cmdArgs[1]);
      return `Filled ${cmdArgs[0]} with "${cmdArgs[1]}"`;

    case 'text':
      return cmdArgs[0]
        ? await page.locator(cmdArgs[0]).first().textContent()
        : await page.evaluate(() => document.body.innerText);

    case 'html':
      return cmdArgs[0]
        ? await page.locator(cmdArgs[0]).first().innerHTML()
        : await page.content();

    case 'wait':
      await page.waitForSelector(cmdArgs[0]);
      return `Element found: ${cmdArgs[0]}`;

    case 'evaluate':
      return JSON.stringify(await page.evaluate(cmdArgs.join(' ')), null, 2);

    case 'cookies':
      const cookies = await context.cookies();
      return JSON.stringify(cookies.map(c => ({ domain: c.domain, name: c.name, expires: c.expires })), null, 2);

    case 'newtab':
      page = await context.newPage();
      if (cmdArgs[0]) await page.goto(cmdArgs[0], { waitUntil: 'domcontentloaded' });
      return `New tab opened${cmdArgs[0] ? ': ' + cmdArgs[0] : ''}`;

    default:
      throw new Error(`Unknown command: ${cmd}. Available: goto, snapshot, screenshot, click, fill, text, html, wait, evaluate, cookies, newtab`);
  }
}

// --- HTTP server ---
const server = createServer(async (req, res) => {
  // Auth check (except health)
  if (req.url !== '/health') {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${token}`) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: (Date.now() - startedAt) / 1000,
      idle: (Date.now() - lastActivity) / 1000,
    }));
    return;
  }

  if (req.url === '/stop' && req.method === 'POST') {
    res.writeHead(200);
    res.end('{"status":"stopping"}');
    await browser.close();
    server.close();
    try { unlinkSync(STATE_FILE); } catch {}
    process.exit(0);
  }

  if (req.url === '/command' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { cmd, args: cmdArgs } = JSON.parse(body);
        const result = await handleCommand(cmd, cmdArgs || []);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', result }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  // Write state file
  writeFileSync(STATE_FILE, JSON.stringify({
    pid: process.pid,
    port: PORT,
    token,
    startedAt: new Date(startedAt).toISOString(),
  }, null, 2), { mode: 0o600 });

  console.log(`Forge browser daemon running on port ${PORT}`);
  console.log(`PID: ${process.pid}`);
  console.log(`Token: ${token}`);
  console.log(`State: ${STATE_FILE}`);
  console.log(`Auto-shutdown after ${IDLE_TIMEOUT / 60000} minutes idle.`);
});

// --- Idle timeout ---
setInterval(() => {
  if (Date.now() - lastActivity > IDLE_TIMEOUT) {
    console.log('Idle timeout reached. Shutting down.');
    browser.close().then(() => {
      try { unlinkSync(STATE_FILE); } catch {}
      process.exit(0);
    });
  }
}, 60000);

// --- Cleanup on exit ---
process.on('SIGINT', async () => {
  await browser.close();
  try { unlinkSync(STATE_FILE); } catch {}
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await browser.close();
  try { unlinkSync(STATE_FILE); } catch {}
  process.exit(0);
});
