#!/usr/bin/env node
/**
 * Forge Browser — CLI para QA testing con Playwright.
 *
 * Nivel 1 (default): cada invocación abre/cierra browser.
 * Nivel 2 (--daemon): conecta a daemon persistente.
 *
 * Uso:
 *   node browse.mjs <command> [args...]
 *
 * Commands:
 *   goto <url>              Navegar a URL
 *   snapshot [-i]           Accessibility tree (con -i: interactive elements only)
 *   screenshot <file>       Captura de pantalla
 *   click <selector|@ref>   Click en elemento
 *   fill <selector> <text>  Llenar input
 *   text [selector]         Extraer texto de la página
 *   html [selector]         Extraer HTML
 *   wait <selector>         Esperar que aparezca elemento
 *   evaluate <js>           Ejecutar JavaScript en la página
 *   pdf <file>              Generar PDF de la página
 *
 * Flags:
 *   --daemon                Conectar a daemon (nivel 2)
 *   --headless=false        Mostrar browser (debug)
 *   --viewport=WxH          Tamaño de viewport (default: 1280x720)
 *   --timeout=ms            Timeout por comando (default: 30000)
 *   --cookies=file.json     Cargar cookies desde archivo
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// --- Config ---
const args = process.argv.slice(2);
const flags = {};
const positional = [];

for (const arg of args) {
  if (arg.startsWith('--')) {
    const [key, val] = arg.slice(2).split('=');
    flags[key] = val ?? 'true';
  } else {
    positional.push(arg);
  }
}

const command = positional[0];
const viewport = (flags.viewport || '1280x720').split('x').map(Number);
const timeout = parseInt(flags.timeout || '30000');
const headless = flags.headless !== 'false';

if (!command) {
  console.error('Usage: node browse.mjs <command> [args...]');
  console.error('Commands: goto, snapshot, screenshot, click, fill, text, html, wait, evaluate, pdf');
  process.exit(1);
}

// --- State file (para mantener estado entre invocaciones en nivel 1) ---
const STATE_FILE = resolve('.forge/.browser-state.json');
let state = { url: null, cookies: [] };

if (existsSync(STATE_FILE)) {
  try { state = JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch {}
}

function saveState(page, context) {
  return context.cookies().then(cookies => {
    state.url = page.url();
    state.cookies = cookies;
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  });
}

// --- Ref system (simplified) ---
let refMap = new Map();

async function buildRefs(page, interactiveOnly = false) {
  const snapshot = await page.accessibility.snapshot({ interestingOnly: interactiveOnly });
  refMap = new Map();
  let counter = 1;

  function walk(node, depth = 0) {
    if (!node) return '';
    const ref = `@e${counter++}`;
    const indent = '  '.repeat(depth);
    const role = node.role || 'unknown';
    const name = node.name ? ` "${node.name}"` : '';
    const value = node.value ? ` value="${node.value}"` : '';

    refMap.set(ref, { role, name: node.name, node });

    let output = `${indent}${ref} [${role}]${name}${value}\n`;

    if (node.children) {
      for (const child of node.children) {
        output += walk(child, depth + 1);
      }
    }
    return output;
  }

  return walk(snapshot);
}

async function resolveRef(page, refOrSelector) {
  if (refOrSelector.startsWith('@e')) {
    const entry = refMap.get(refOrSelector);
    if (!entry) throw new Error(`Ref ${refOrSelector} not found. Run 'snapshot' first.`);
    return page.getByRole(entry.role, { name: entry.name }).first();
  }
  return page.locator(refOrSelector).first();
}

// --- Main ---
async function main() {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: viewport[0], height: viewport[1] },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  // Restaurar cookies si hay estado previo
  if (state.cookies.length > 0) {
    await context.addCookies(state.cookies);
  }

  // Cargar cookies desde archivo si se especificó
  if (flags.cookies && existsSync(flags.cookies)) {
    const cookies = JSON.parse(readFileSync(flags.cookies, 'utf8'));
    await context.addCookies(cookies);
  }

  const page = await context.newPage();
  page.setDefaultTimeout(timeout);

  // Restaurar URL si hay estado previo y no es goto
  if (state.url && command !== 'goto') {
    try { await page.goto(state.url, { waitUntil: 'domcontentloaded' }); } catch {}
  }

  try {
    switch (command) {
      case 'goto': {
        const url = positional[1];
        if (!url) throw new Error('Usage: goto <url>');
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        console.log(`Navigated to ${url} — ${response?.status() || 'unknown'}`);
        break;
      }

      case 'snapshot': {
        const interactive = flags.i === 'true' || positional.includes('-i');
        const tree = await buildRefs(page, interactive);
        console.log(tree);
        break;
      }

      case 'screenshot': {
        const file = positional[1] || 'screenshot.png';
        await page.screenshot({ path: file, fullPage: !!flags.fullPage });
        console.log(`Screenshot saved: ${file}`);
        break;
      }

      case 'click': {
        const target = positional[1];
        if (!target) throw new Error('Usage: click <selector|@ref>');
        const el = await resolveRef(page, target);
        await el.click();
        console.log(`Clicked: ${target}`);
        break;
      }

      case 'fill': {
        const target = positional[1];
        const text = positional[2];
        if (!target || !text) throw new Error('Usage: fill <selector|@ref> <text>');
        const el = await resolveRef(page, target);
        await el.fill(text);
        console.log(`Filled ${target} with "${text}"`);
        break;
      }

      case 'text': {
        const selector = positional[1];
        const text = selector
          ? await page.locator(selector).first().textContent()
          : await page.evaluate(() => document.body.innerText);
        console.log(text?.trim() || '(empty)');
        break;
      }

      case 'html': {
        const selector = positional[1];
        const html = selector
          ? await page.locator(selector).first().innerHTML()
          : await page.content();
        console.log(html);
        break;
      }

      case 'wait': {
        const selector = positional[1];
        if (!selector) throw new Error('Usage: wait <selector>');
        await page.waitForSelector(selector, { timeout });
        console.log(`Element found: ${selector}`);
        break;
      }

      case 'evaluate': {
        const js = positional.slice(1).join(' ');
        if (!js) throw new Error('Usage: evaluate <javascript>');
        const result = await page.evaluate(js);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'pdf': {
        const file = positional[1] || 'page.pdf';
        await page.pdf({ path: file, format: 'A4' });
        console.log(`PDF saved: ${file}`);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Commands: goto, snapshot, screenshot, click, fill, text, html, wait, evaluate, pdf');
        process.exit(1);
    }

    await saveState(page, context);
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
