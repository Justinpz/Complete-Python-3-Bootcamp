// End-to-end for the voice → task flow. Real speech can't run headlessly, so a
// fake SpeechRecognition is installed before app scripts execute and driven
// like the browser would: interim results, then finalized text, then onend.
//
//   npm run build && npm run e2e:voice [-- --shots-dir <dir>]

import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4519;
const BASE = `http://localhost:${PORT}`;
const CHROMIUM =
  process.env.E2E_CHROMIUM ||
  ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find(existsSync);

const shotsIdx = process.argv.indexOf('--shots-dir');
const SHOTS = shotsIdx > -1 ? process.argv[shotsIdx + 1] : 'e2e-shots';
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function check(name, ok) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures += 1;
    console.error(`  ✗ ${name}`);
  }
}

// Mimics the real API closely enough to exercise our restart/accumulate logic.
const FAKE_SPEECH = `
window.__speechLog = [];
class FakeSpeechRecognition {
  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.lang = 'en-US';
    window.__rec = this;
  }
  start() {
    window.__speechLog.push('start');
    this.running = true;
  }
  stop() {
    window.__speechLog.push('stop');
    this.running = false;
    this.onend && this.onend();
  }
  abort() { this.stop(); }
  // test helper: emit a results event
  __say(text, isFinal) {
    const results = [[{ transcript: text }]];
    results[0].isFinal = isFinal;
    results.length = 1;
    this.onresult && this.onresult({ resultIndex: 0, results });
  }
  __endSession() { this.onend && this.onend(); }
}
window.SpeechRecognition = FakeSpeechRecognition;
window.webkitSpeechRecognition = FakeSpeechRecognition;
`;

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(BASE)).ok) return;
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
  const errors = [];
  // `vite preview` serves no functions, so the synthesis call 404s on purpose —
  // that IS the fallback path under test. Any other console error is a failure.
  const EXPECTED_404 = /404 \(Not Found\)/;
  let sawFallback404 = false;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (EXPECTED_404.test(m.text())) {
      sawFallback404 = true;
      return;
    }
    errors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.url().includes('/.netlify/functions/synthesize') && r.status() === 404) sawFallback404 = true;
  });

  await page.addInitScript(FAKE_SPEECH);
  // No function is deployed against `vite preview`, so this exercises the
  // offline/rule-based fallback path end to end.
  await page.goto(`${BASE}/#/project/inbox`);
  await page.waitForSelector('.side-voice');

  console.log('▸ opening via keyboard shortcut');
  await page.keyboard.press('v');
  await page.waitForSelector('.voice');
  check('voice panel opens on "v"', true);

  console.log('▸ dictating');
  await page.click('.mic-btn');
  await page.waitForSelector('.mic-live');
  check('mic shows a live state', true);
  check('recognition was started', (await page.evaluate(() => window.__speechLog)).includes('start'));

  await page.evaluate(() => window.__rec.__say('um so i need to call the dentist tomorrow', false));
  await page.waitForTimeout(80);
  const interim = await page.inputValue('.voice-textarea');
  check('interim text appears while speaking', interim.includes('dentist'));

  await page.evaluate(() => window.__rec.__say('um so i need to call the dentist tomorrow', true));
  await page.waitForTimeout(80);

  console.log('▸ session drops mid-thought (the iOS behavior)');
  await page.evaluate(() => window.__rec.__endSession());
  await page.waitForTimeout(120);
  check('still listening after the browser ends the session', await page.locator('.mic-live').isVisible());
  const restarts = (await page.evaluate(() => window.__speechLog)).filter((e) => e === 'start').length;
  check(`recognition auto-restarted (${restarts} starts)`, restarts >= 2);

  await page.evaluate(() =>
    window.__rec.__say(' and also pick up milk and submit the report thats urgent', true),
  );
  await page.waitForTimeout(80);
  const full = await page.inputValue('.voice-textarea');
  check('finalized speech accumulates across restarts', full.includes('dentist') && full.includes('milk'));

  console.log('▸ synthesizing');
  await page.click('.mic-btn'); // stop
  await page.screenshot({ path: `${SHOTS}/voice-01-capture.png` });
  await page.click('.voice .skew-btn');
  await page.waitForSelector('.candidate');
  const titles = await page.locator('.candidate-title').allTextContents();
  check('fell back to on-device extraction when no function is deployed', sawFallback404);
  check(
    'the fallback is disclosed in the UI',
    (await page.textContent('.voice-hint')).includes('on-device'),
  );
  check(`extracted 3 tasks (${titles.join(' | ')})`, titles.length === 3);
  check('lead-ins and filler stripped', titles[0] === 'Call the dentist');
  check('urgency became P1', (await page.locator('.candidate .chip-priority.pr1').count()) === 1);
  check('relative date resolved', (await page.locator('.candidate .chip-due').count()) >= 1);
  await page.screenshot({ path: `${SHOTS}/voice-02-review.png` });

  console.log('▸ editing and deselecting before committing');
  await page.locator('.candidate-title').nth(1).click();
  await page.locator('.candidate input').fill('Pick up oat milk');
  await page.keyboard.press('Enter');
  await page.locator('.candidate-check').nth(2).click();
  await page.waitForTimeout(60);
  check('deselected row dims', (await page.locator('.candidate-off').count()) === 1);
  check('button reflects the selection', (await page.textContent('.voice .skew-btn')).includes('2'));

  await page.click('.voice .skew-btn');
  await page.waitForSelector('.voice', { state: 'detached' });
  await page.waitForSelector('.task-row');
  const rows = await page.locator('.task-title').allTextContents();
  check(`only selected tasks were added (${rows.join(' | ')})`, rows.length === 2);
  check('the edit was kept', rows.includes('Pick up oat milk'));
  check('the unchecked task was not added', !rows.some((r) => r.includes('report')));
  await page.screenshot({ path: `${SHOTS}/voice-03-added.png` });

  console.log('▸ phone viewport');
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.addInitScript(FAKE_SPEECH);
  await phone.goto(`${BASE}/#/project/inbox`);
  await phone.click('.nav-toggle');
  await phone.waitForTimeout(250);
  await phone.click('.side-voice');
  await phone.waitForSelector('.voice');
  check('opens on phone', true);
  check(
    'no horizontal overflow',
    await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  await phone.screenshot({ path: `${SHOTS}/voice-04-phone.png` });

  check('no console errors', errors.length === 0);
  if (errors.length) console.error(errors);
  await browser.close();
}

try {
  await main();
} catch (err) {
  failures += 1;
  console.error('✗ voice smoke crashed:', err);
} finally {
  preview.kill();
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
