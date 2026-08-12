// Browser check of the PUBLISHED npm package: docs/npm-check.html imports
// maplibre-gl-panoramax from the CDN (not ../src) and must report OK with the
// coverage layers added. Catches broken publishes (missing files, dead import
// graph) that the repo-local demo cannot see.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.env.TARGET_URL || 'http://web/docs/npm-check.html';
console.log(`[npm-smoke] target: ${url}`);

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(String(err)));

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(
  () => /^(OK npm |ERROR)/.test(document.querySelector('#status')?.textContent || ''),
  { timeout: 45000 }
);
const text = (await page.textContent('#status')).trim();
console.log(`[npm-smoke] status: ${text}`);

assert.ok(text.startsWith('OK npm maplibre-gl-panoramax@'), `package check failed: ${text}`);
assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`);

console.log('[npm-smoke] PASS — published package loads and boots from the CDN');
await browser.close();
