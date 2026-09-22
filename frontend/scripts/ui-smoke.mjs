import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

// CI installs the pinned browser runtime outside production dependencies.
const require = createRequire(process.env.PLAYWRIGHT_RUNTIME ? path.join(process.env.PLAYWRIGHT_RUNTIME, 'package.json') : import.meta.url);
const { chromium } = require('playwright');
const origin = process.env.UI_TEST_ORIGIN ?? 'http://127.0.0.1:3000';
const output = path.resolve('test-results/ui');
await mkdir(output, { recursive: true });
const token = `fixture.${Buffer.from(JSON.stringify({ sub: 'ui-fixture', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64')}.fixture`;
const user = { id: 'ui-fixture', username: 'demo', display_name: 'Demo workspace', created_at: '2026-09-01T00:00:00Z' };
let groups = [
  { id: 'group-europe', name: 'Europe network', kind: 'subscription', url: 'https://example.com/private?token=fixture-secret', enabled: true, cron_expr: '', export_sort: 'speed_desc', export_include_dead: false, created_at: '2026-09-01T00:00:00Z' },
  { id: 'group-asia', name: 'Asia direct node', kind: 'node', url: 'ss://fixture-private', enabled: false, cron_expr: '', export_sort: 'speed_desc', export_include_dead: false, created_at: '2026-09-01T00:00:00Z' },
];
const latestJobs = { 'group-europe': { id: 'check-europe', subscription_id: 'group-europe', status: 'completed', total: 24, available: 21, avg_latency_ms: 82, created_at: '2026-09-23T08:00:00Z', finished_at: '2026-09-23T08:02:00Z' } };
let failGroups = false;
const requests = new Set();
const errors = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
await context.addInitScript(() => { localStorage.setItem('theme', 'light'); });
await context.route('**/api/**', async (route) => {
  const request = route.request();
  const pathname = new URL(request.url()).pathname;
  const lower = pathname.toLowerCase();
  requests.add(`${request.method()} ${pathname}`);
  if (failGroups && /subscriptions?(?:\/|\.|$)/.test(lower) && !lower.includes('jobs')) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'unavailable', message: 'Intentional UI fixture failure' }) });
  const data = { ...user, token, subscriptions: groups, nodes: [], rules: [], jobs: lower.includes('latest') ? latestJobs : [], channels: [], tags: [], results: [] };
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
});
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
const checks = [];
async function screenshot(name) { await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled' }); }
async function noOverflow(name) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, `${name}: document has horizontal overflow`);
  checks.push(`${name}: no document overflow`);
}
try {
  await page.goto(`${origin}/login`);
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('demo');
  await page.getByLabel('Password', { exact: true }).fill('ui-fixture-only');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'text');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  checks.push('login: password visibility toggle');
  await screenshot('login-light');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Your network, at a glance' }).waitFor();
  await page.getByRole('button', { name: /Europe network/ }).first().waitFor();
  assert.equal((await page.locator('body').innerText()).includes('fixture-secret'), false);
  await screenshot('workspace-light');
  await noOverflow('desktop workspace');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  assert.equal(await page.locator('html').evaluate((element) => element.classList.contains('dark')), true);
  await screenshot('workspace-dark');
  checks.push('theme: light/dark switching');
  await page.locator('[data-slot="workspace-sidebar"] button[aria-controls]').click();
  assert.equal(await page.locator('[data-slot="workspace-sidebar"]').getAttribute('data-collapsed'), 'true');
  await page.locator('[data-slot="workspace-sidebar"] button[aria-controls]').click();
  checks.push('sidebar: collapse and expand');
  await page.getByRole('button', { name: 'Add node group', exact: true }).first().click();
  await page.getByRole('dialog').waitFor();
  await screenshot('create-group-dialog');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  checks.push('groups: open and close create dialog');
  await page.goto(`${origin}/scheduler`);
  await page.getByRole('heading', { name: 'Scheduler', exact: true }).waitFor();
  await screenshot('scheduler-desktop');
  await page.goto(`${origin}/settings/account`);
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await screenshot('settings-account');
  await page.goto(`${origin}/rules`);
  await page.getByRole('button', { name: 'Create rule', exact: true }).waitFor();
  await screenshot('rules-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Node groups', exact: true }).waitFor();
  await page.getByRole('searchbox', { name: 'Search node groups' }).fill('Europe');
  assert.equal(await page.getByRole('button', { name: /Asia direct node/ }).count(), 0);
  await screenshot('workspace-mobile');
  await noOverflow('mobile workspace');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Scheduler', exact: true }).click();
  await page.getByRole('heading', { name: 'Scheduler', exact: true }).waitFor();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  checks.push('mobile: drawer navigation and search');
  await screenshot('scheduler-mobile');
  await noOverflow('mobile scheduler');
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(`${origin}/settings/account`);
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await noOverflow('320px settings');
  await screenshot('settings-small-mobile');
  await page.setViewportSize({ width: 1440, height: 1000 });
  failGroups = true;
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Unable to load node groups', exact: true }).waitFor({ timeout: 20000 });
  await screenshot('groups-error');
  failGroups = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('heading', { name: 'Your network, at a glance' }).waitFor();
  checks.push('groups: request error and retry recovery');
  groups = [];
  await page.reload();
  await page.getByRole('heading', { name: 'Bring your nodes together.', exact: true }).waitFor();
  await screenshot('workspace-empty');
  checks.push('groups: separate empty state');
  assert.deepEqual(errors, [], 'Uncaught browser errors');
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ backend: 'mocked fixtures only; no real account or backend was contacted', checks, requests: [...requests], errors }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks, requests: [...requests] }, null, 2));
} catch (error) {
  await screenshot('failure').catch(() => {});
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ message: String(error), requests: [...requests], errors }, null, 2));
  throw error;
} finally { await browser.close(); }
