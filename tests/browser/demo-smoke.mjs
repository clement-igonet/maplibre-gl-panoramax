// Minimal browser smoke for the maplibre-gl-panoramax Pages demo: the page
// must load with zero page errors (module-graph failures land here), zero
// console errors, and the MapMax HUD must leave "Loading map…" (app booted).
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.env.TARGET_URL || 'http://web/docs/';
console.log(`[smoke] target: ${url}`);

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (err) => pageErrors.push(String(err)));
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

await page.goto(url, { waitUntil: 'load', timeout: 60000 });

// The HUD status starts as "Loading map…" in static HTML; main.js replaces it
// once the map style loads. Stuck text = the module graph never ran.
await page.waitForFunction(
  () => {
    const el = document.querySelector('#hud-status');
    return el && !/loading map/i.test(el.textContent);
  },
  { timeout: 45000 }
);
const hud = await page.textContent('#hud-status');
console.log(`[smoke] HUD status: ${hud.trim()}`);

// The pose panel must be hidden on boot (it leaks visible when main.js dies).
const poseHidden = await page.$eval('#pose-panel', (el) => el.hidden);
assert.ok(poseHidden, 'pose panel should be hidden before entering a panorama');

assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`);
const realErrors = consoleErrors.filter((e) => !/WebGL|GPU|swiftshader/i.test(e));
assert.deepEqual(realErrors, [], `console errors: ${realErrors.join(' | ')}`);

console.log('[smoke] PASS — module graph loads, app boots, no errors');
await browser.close();
