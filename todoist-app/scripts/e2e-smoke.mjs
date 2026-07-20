// End-to-end smoke test: builds are assumed done (`npm run build` first).
// Serves dist/ via `vite preview`, drives the real UI with playwright-core
// against the preinstalled Chromium, and screenshots every view.
//
//   npm run build && npm run e2e [-- --shots-dir <dir>]

import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4517;
const BASE = `http://localhost:${PORT}`;
const CHROMIUM =
  process.env.E2E_CHROMIUM ||
  ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);

const shotsIdx = process.argv.indexOf('--shots-dir');
const SHOTS = shotsIdx > -1 ? process.argv[shotsIdx + 1] : 'e2e-shots';
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function check(name, ok) {
  if (ok) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}`);
  }
}

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
});

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('vite preview never came up');
}

async function main() {
  await waitForServer();
  const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });

  console.log('▸ inbox: quick-add with NL date, priority, label');
  await page.goto(`${BASE}/#/project/inbox`);
  await page.waitForSelector('.side-brand-name');
  await page.keyboard.press('q');
  await page.waitForSelector('.quickadd-input');
  await page.fill('.quickadd-input', 'Buy milk tomorrow p1 @errands');
  await page.waitForSelector('.quickadd-chips .chip-due');
  check('due chip shows Tomorrow', (await page.textContent('.quickadd-chips .chip-due')).includes('Tomorrow'));
  check('priority chip shows P1', (await page.textContent('.quickadd-chips .chip-priority')) === 'P1');
  check('label chip offers @errands', (await page.textContent('.quickadd-chips .chip-label')).includes('@errands'));
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.task-row');
  check('task row rendered', (await page.textContent('.task-title')) === 'Buy milk');
  check('row due chip says Tomorrow', (await page.textContent('.task-row .chip-due')).includes('Tomorrow'));
  check('checkbox has P1 ring', (await page.locator('.task-check.p1').count()) === 1);
  await shot('01-inbox');

  console.log('▸ complete task → XP toast');
  await page.click('.task-check');
  await page.waitForSelector('.toast-xp');
  const toastText = await page.textContent('.toast-xp .toast-text');
  check(`toast shows XP gain (${toastText})`, /^\+\d+ XP$/.test(toastText));
  await page.waitForSelector('.task-row', { state: 'detached' });
  check('task left the active list', true);

  console.log('▸ recurring task advances on completion');
  await page.keyboard.press('q');
  await page.fill('.quickadd-input', 'Water plants every 2 days');
  await page.waitForSelector('.quickadd-chips .chip-due');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.task-row');
  check('recurring chip starts Today', (await page.textContent('.task-row .chip-due')).includes('Today'));
  await page.click('.task-check');
  await page.waitForSelector('.toast-xp');
  await page.waitForFunction(() => {
    const chip = document.querySelector('.task-row .chip-due');
    return chip && !chip.textContent.includes('Today');
  });
  const advanced = await page.textContent('.task-row .chip-due');
  check(`recurring task rescheduled (now "${advanced.trim()}")`, advanced.includes('In') || !advanced.includes('Today'));
  check('recurring task still active', (await page.locator('.task-row').count()) === 1);

  console.log('▸ views render');
  await page.goto(`${BASE}/#/today`);
  await page.waitForSelector('.view-head h1');
  await shot('02-today');
  await page.goto(`${BASE}/#/upcoming`);
  await page.waitForSelector('.block-day');
  check('upcoming shows day groups', (await page.locator('.block-day').count()) === 14);
  await shot('03-upcoming');
  await page.goto(`${BASE}/#/completed`);
  await page.waitForSelector('.completed-row');
  check('completed log has 2 entries', (await page.locator('.completed-row').count()) === 2);
  await shot('04-completed');
  await page.goto(`${BASE}/#/stats`);
  await page.waitForSelector('.stats-hero-number');
  const xpTotal = await page.textContent('.stats-hero-total');
  check(`stats shows lifetime XP (${xpTotal.trim()})`, /^[1-9]\d* lifetime XP/.test(xpTotal.trim()));
  check('goal ring counts 2 today', (await page.textContent('.goal-ring-count')).startsWith('2/'));
  await shot('05-stats');

  console.log('▸ persistence across reload');
  await page.goto(`${BASE}/#/project/inbox`);
  await page.reload();
  await page.waitForSelector('.task-row');
  check('recurring task survived reload', (await page.textContent('.task-title')) === 'Water plants');
  check('label survived reload', (await page.locator('.sidebar .nav-item', { hasText: '@errands' }).count()) === 1);

  await browser.close();
}

try {
  await main();
} catch (err) {
  failures += 1;
  console.error('✗ smoke run crashed:', err);
} finally {
  preview.kill();
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
