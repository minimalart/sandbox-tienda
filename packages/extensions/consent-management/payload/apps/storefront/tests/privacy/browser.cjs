// Isolated browser integration test using the real provider, engine and GA component.
// Network measurement calls are intercepted; this never sends test traffic to Google.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const modules = process.env.PRIVACY_TEST_MODULES;
const dependency = modules
  ? createRequire(path.join(path.resolve(modules), '..', 'package.json'))
  : require;
const { chromium } = dependency(modules ? 'playwright' : '@playwright/test');
const esbuild = dependency('esbuild');

async function main() {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'brick-consent-browser-'));
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'harness.tsx')],
    bundle: true,
    outfile: path.join(output, 'harness.js'),
    jsx: 'automatic',
    nodePaths: modules ? [path.resolve(modules)] : [],
    alias: {
      'next/navigation': path.join(__dirname, 'navigation.ts'),
      ...(modules
        ? {
            react: path.join(path.resolve(modules), 'react'),
            'react-dom': path.join(path.resolve(modules), 'react-dom'),
          }
        : {}),
    },
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  const html =
    '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/harness.css"></head><body><div id="root"></div><script src="/harness.js"></script></body></html>';
  const server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname;
    if (name === '/harness.js' || name === '/harness.css') {
      res.setHeader('Content-Type', name.endsWith('.css') ? 'text/css' : 'application/javascript');
      return res.end(fs.readFileSync(path.join(output, name)));
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  });
  try {
    const page = await browser.newPage();
    const hits = [],
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://www.googletagmanager.com/**', (route) => {
      hits.push(route.request().url());
      return route.fulfill({
        contentType: 'application/javascript',
        body: 'window.__gaLoaded = true;',
      });
    });
    await page.goto(origin);
    await page.getByRole('button', { name: 'Rechazar opcionales', exact: true }).click();
    assert.equal(hits.length, 0);
    await page.reload();
    await page.waitForTimeout(100);
    assert.equal(hits.length, 0);
    await page.getByRole('button', { name: 'Preferencias de cookies', exact: true }).click();
    await page.getByRole('button', { name: 'Aceptar todas', exact: true }).click();
    await page.waitForFunction(() => window.__gaLoaded);
    assert.equal(hits.length, 1);
    await page.getByRole('button', { name: 'Navigate', exact: true }).click();
    assert.ok(
      await page.evaluate(() =>
        window.dataLayer.some((c) => c[0] === 'event' && c[2].page_path?.startsWith('/next'))
      )
    );
    await page.getByRole('button', { name: 'Preferencias de cookies', exact: true }).click();
    await page.getByRole('button', { name: 'Rechazar opcionales', exact: true }).click();
    await page.waitForFunction(() => window['ga-disable-G-STOREA'] === true);
    const before = await page.evaluate(
      () => window.dataLayer.filter((c) => c[0] === 'event').length
    );
    await page.getByRole('button', { name: 'Navigate', exact: true }).click();
    assert.equal(
      await page.evaluate(() => window.dataLayer.filter((c) => c[0] === 'event').length),
      before
    );
    await page.goto(origin + '/?site=b&lang=en');
    await page.getByRole('button', { name: 'Reject optional', exact: true }).waitFor();
    assert.equal(hits.length, 1);
    await page.getByRole('button', { name: 'Accept all', exact: true }).click();
    await page.waitForFunction(() => window.__gaLoaded);
    assert.ok(hits.at(-1).includes('G-STOREB'));
    await page.goto(origin + '/?site=b&lang=en&revision=2');
    await page.getByRole('button', { name: 'Reject optional', exact: true }).waitFor();
    assert.equal(hits.length, 2);
    // Browser theme tokens, not a customer palette.
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--background', '222 18% 11%');
      document.documentElement.style.setProperty('--foreground', '0 0% 92%');
    });
    await page.screenshot({ path: path.join(output, 'consent-dark-en.png'), fullPage: true });
    await page.goto(origin + '/?site=optout&mode=opt-out');
    await page.waitForFunction(() => window.__gaLoaded);
    await page.getByRole('button', { name: 'Rechazar opcionales', exact: true }).click();
    await page.waitForFunction(() => window['ga-disable-G-STOREA'] === true);
    await page.goto(origin + '/?site=legacy&enabled=false');
    await page.waitForFunction(() => window.__gaLoaded);
    assert.equal(
      await page.getByRole('button', { name: 'Preferencias de cookies', exact: true }).count(),
      0
    );
    await page.route('**/api/store/privacy?**', async (route) => {
      const consent = await page.evaluate(() => ({
        ...window.__fixtureConsent,
        enabled: true,
        mode: 'opt-in',
      }));
      return route.fulfill({
        json: {
          siteId: 'c',
          pathPrefix: '/demo/c',
          available: true,
          analyticsAvailable: true,
          legacyAllowed: false,
          consent,
          analytics: {
            enabled: true,
            measurementId: 'G-STOREC',
            consentCategory: 'analytics',
            pathPrefix: '/demo/c',
          },
        },
      });
    });
    const beforeSwitch = await page.evaluate(
      () => window.dataLayer.filter((c) => c[0] === 'event').length
    );
    await page.getByRole('button', { name: 'Change store', exact: true }).click();
    await page.getByRole('button', { name: 'Aceptar todas', exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => window.dataLayer.filter((c) => c[0] === 'event').length),
      beforeSwitch
    );
    assert.equal(await page.evaluate(() => window['ga-disable-G-STOREA']), true);
    await page.getByRole('button', { name: 'Aceptar todas', exact: true }).click();
    await page.waitForFunction(() =>
      window.dataLayer.some((c) => c[0] === 'event' && c[2].send_to === 'G-STOREC')
    );
    // Clarity uses the same real provider; the vendor boundary records API commands.
    if (
      fs
        .readFileSync(path.join(__dirname, '../../src/lib/privacy-slot.tsx'), 'utf8')
        .includes("from './analytics/clarity'")
    ) {
      const clarityHits = [];
      await page.route('https://www.clarity.ms/**', (route) => {
        clarityHits.push(route.request().url());
        return route.fulfill({
          contentType: 'application/javascript',
          body: `
        const queued = window.clarity.q || []; window.__clarityCommands = [];
        window.clarity = (...args) => { window.__clarityCommands.push(args); };
        queued.forEach(args => window.clarity(...args)); window.__clarityLoaded = true;
      `,
        });
      });
      await page.context().clearCookies();
      await page.goto(origin + '/?clarity=abc123');
      await page.getByRole('button', { name: 'Rechazar opcionales', exact: true }).click();
      assert.equal(clarityHits.length, 0);
      await page.reload();
      assert.equal(clarityHits.length, 0);
      await page.getByRole('button', { name: 'Preferencias de cookies', exact: true }).click();
      await page.getByRole('button', { name: 'Aceptar todas', exact: true }).click();
      await page.waitForFunction(() => window.__clarityLoaded);
      assert.equal(clarityHits.length, 1);
      assert.ok(
        await page.evaluate(() =>
          window.__clarityCommands.some(
            (c) => c[0] === 'consentv2' && c[1].analytics_Storage === 'granted'
          )
        )
      );
      await page.getByRole('button', { name: 'Preferencias de cookies', exact: true }).click();
      await page.getByRole('button', { name: 'Rechazar opcionales', exact: true }).click();
      await page.waitForFunction(() => window.__clarityCommands.some((c) => c[0] === 'stop'));
      assert.ok(
        await page.evaluate(() =>
          window.__clarityCommands.some(
            (c) => c[0] === 'consentv2' && c[1].analytics_Storage === 'denied'
          )
        )
      );
      await page.reload();
      assert.equal(clarityHits.length, 1);
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS: reject/reload, accept, SPA, revoke, site isolation, revision, ES/EN, opt-out, disabled module. Artifacts: ' +
        output
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
