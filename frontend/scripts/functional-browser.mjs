import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const require = createRequire(process.env.PLAYWRIGHT_RUNTIME ? path.join(process.env.PLAYWRIGHT_RUNTIME, 'package.json') : import.meta.url);
const { chromium } = require('playwright');
const origin = process.env.UI_TEST_ORIGIN ?? 'http://127.0.0.1:3000';
const backend = process.env.NODEPLANE_API_ORIGIN ?? 'http://127.0.0.1:4000';
const fixture = process.env.NODEPLANE_FIXTURE_ORIGIN ?? 'http://127.0.0.1:18081';
if (process.env.NODEPLANE_E2E_DISPOSABLE !== '1') throw new Error('Refusing writes without NODEPLANE_E2E_DISPOSABLE=1');
for (const value of [origin, backend, fixture]) {
  const url = new URL(value);
  assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.username && !url.password, 'Only disposable loopback HTTP instances are allowed');
}
const password = 'NodePlane-browser-fixture-2026';
const invite = process.env.REGISTER_INVITE_CODE ?? 'ashark';
const output = path.resolve('test-results/functional');
await mkdir(output, { recursive: true });
const checks = [];
const browser = await chromium.launch({ headless: true });

async function request(method, route, body, token, status = 200) {
  const response = await fetch(backend + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  let value; try { value = JSON.parse(text); } catch { value = text; }
  assert.equal(response.status, status, `${method} ${route.split('?')[0]}: unexpected response ${response.status}`);
  return value;
}
async function account() {
  const username = `browser_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  await request('POST', '/auth/register', { username, password, invite_code: invite });
  const { token } = await request('POST', '/auth/login', { username, password });
  return { username, token };
}
async function poll(check, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { return await check(); } catch (error) { last = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw last ?? new Error('Assertion deadline exceeded');
}
async function mutation(page, method, endpoint, action, expected = 200) {
  const pending = page.waitForResponse(r => r.request().method() === method && new URL(r.url()).pathname === `/api${endpoint}`);
  await action();
  const response = await pending;
  assert.equal(response.status(), expected, `${method} ${endpoint}`);
  return response.json();
}
async function login(page, credentials) {
  await page.goto(origin + '/login');
  await page.getByLabel('Username', { exact: true }).fill(credentials.username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await mutation(page, 'POST', '/auth/login', () => page.getByRole('button', { name: 'Sign in', exact: true }).click());
  await page.getByRole('button', { name: 'Account menu', exact: true }).waitFor();
}
async function group(token, name = 'Browser group') {
  return request('POST', '/subscriptions', { kind: 'subscription', name, url: fixture + '/subscription.yaml' }, token);
}
async function configure(token, latency = '/health') {
  const settings = await request('GET', '/settings', undefined, token);
  await request('PUT', '/settings', { ...settings, latency_test_url: fixture + latency, speed_test_url: fixture + '/download', upload_test_url: fixture + '/upload' }, token);
}
async function openGroup(page, id) {
  await page.goto(`${origin}/?sub=${id}`);
  await page.getByRole('button', { name: 'Node group actions' }).waitFor();
}
async function run(name, body, { anonymous = false, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const started = Date.now();
  try {
    const credentials = await account();
    if (!anonymous) await login(page, credentials);
    await body(page, credentials, context);
    assert.deepEqual(errors, [], 'Uncaught browser errors');
    checks.push({ name, status: 'passed', duration_ms: Date.now() - started });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, status: 'failed', duration_ms: Date.now() - started, error: error.message, browser_errors: errors });
    await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true }).catch(() => {});
    console.error(`FAIL ${name}: ${error.stack}`);
  } finally { await context.close(); }
}

await run('auth-error-retention-and-session', async (page, credentials) => {
  await page.goto(origin + '/login');
  await page.getByLabel('Username', { exact: true }).fill(credentials.username);
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password');
  await mutation(page, 'POST', '/auth/login', () => page.getByRole('button', { name: 'Sign in', exact: true }).click(), 401);
  await page.getByRole('alert').first().waitFor();
  assert.equal(await page.getByLabel('Username', { exact: true }).inputValue(), credentials.username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await mutation(page, 'POST', '/auth/login', () => page.getByRole('button', { name: 'Sign in', exact: true }).click());
  await page.getByRole('button', { name: 'Account menu' }).waitFor();
  assert.ok(await page.evaluate(() => sessionStorage.getItem('jwt_token')));
  assert.equal(await page.evaluate(() => localStorage.getItem('jwt_token')), null);
  await page.reload();
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await page.getByLabel('Username', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('jwt_token')), null);
}, { anonymous: true });

await run('registration-and-remember-me', async (page) => {
  const username = `signup_${randomUUID().slice(0, 8)}`;
  await page.goto(origin + '/login');
  await page.getByRole('button', { name: 'Have an invitation? Create an account' }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Invite code').fill('wrong-invitation');
  await mutation(page, 'POST', '/auth/register', () => page.getByRole('button', { name: 'Create account', exact: true }).click(), 400);
  await page.getByRole('alert').first().waitFor();
  await page.getByLabel('Invite code').fill(invite);
  await mutation(page, 'POST', '/auth/register', () => page.getByRole('button', { name: 'Create account', exact: true }).click());
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel(/Remember me/).check();
  await mutation(page, 'POST', '/auth/login', () => page.getByRole('button', { name: 'Sign in', exact: true }).click());
  await page.getByRole('button', { name: 'Account menu' }).waitFor();
  assert.ok(await page.evaluate(() => localStorage.getItem('jwt_token')));
  assert.equal(await page.evaluate(() => sessionStorage.getItem('jwt_token')), null);
}, { anonymous: true });

await run('group-create-edit-refresh-disable-delete', async (page, { token }) => {
  await page.getByRole('button', { name: 'Add node group', exact: true }).first().click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Name/).fill('Created in browser');
  await dialog.getByLabel('Subscription URL').fill('invalid-url');
  await dialog.getByRole('button', { name: 'Add group', exact: true }).click();
  assert.equal((await request('GET', '/subscriptions', undefined, token)).subscriptions.length, 0);
  await dialog.getByLabel('Subscription URL').fill(fixture + '/subscription.yaml');
  const created = await mutation(page, 'POST', '/subscriptions', () => dialog.getByRole('button', { name: 'Add group', exact: true }).click());
  await dialog.waitFor({ state: 'hidden' });
  await openGroup(page, created.id);
  await page.getByRole('button', { name: 'Node source' }).click();
  const tested = await mutation(page, 'POST', `/subscription/${created.id}/test-fetch`, () => page.getByRole('menuitem', { name: 'Test URL', exact: true }).click());
  assert.equal(tested.ok, true);
  assert.equal((await request('GET', `/subscription/${created.id}/nodes`, undefined, token)).nodes.length, 0);
  await page.getByRole('button', { name: 'Node source' }).click();
  await mutation(page, 'POST', `/subscription/${created.id}/refresh`, () => page.getByRole('menuitem', { name: 'Refresh from URL', exact: true }).click());
  await poll(async () => assert.equal((await request('GET', `/subscription/${created.id}/nodes`, undefined, token)).nodes.length, 2));
  await page.getByRole('button', { name: 'Node group actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Name/).fill('Renamed in browser');
  await mutation(page, 'PUT', `/subscriptions/${created.id}`, () => dialog.getByRole('button', { name: 'Save', exact: true }).click());
  await dialog.waitFor({ state: 'hidden' });
  assert.equal((await request('GET', `/subscriptions/${created.id}`, undefined, token)).name, 'Renamed in browser');
  await page.getByRole('button', { name: 'Node group actions' }).click();
  await mutation(page, 'PUT', `/subscriptions/${created.id}`, () => page.getByRole('menuitem', { name: 'Disable', exact: true }).click());
  assert.equal((await request('GET', `/subscriptions/${created.id}`, undefined, token)).enabled, false);
  await page.getByRole('button', { name: 'Node group actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal((await request('GET', '/subscriptions', undefined, token)).subscriptions.length, 1);
  await page.getByRole('button', { name: 'Node group actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await mutation(page, 'DELETE', `/subscriptions/${created.id}`, () => page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click());
  assert.equal((await request('GET', '/subscriptions', undefined, token)).subscriptions.length, 0);
});

await run('single-node-import-and-rollback', async (page, { token }) => {
  await page.getByRole('button', { name: 'Add node group', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Single node/ }).click();
  await dialog.getByLabel(/Name/).fill('Direct fixture');
  await dialog.getByLabel('Node share link').fill('invalid-node');
  await dialog.getByRole('button', { name: 'Add group', exact: true }).click();
  await page.getByText('Request failed', { exact: true }).waitFor({ timeout: 1500 }).catch(() => {});
  await poll(async () => assert.equal((await request('GET', '/subscriptions', undefined, token)).subscriptions.length, 0));
  const secret = Buffer.from('aes-128-gcm:fixture').toString('base64');
  await dialog.getByLabel('Node share link').fill(`ss://${secret}@192.0.2.1:8388#DirectFixture`);
  await dialog.getByRole('button', { name: 'Add group', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const groups = (await request('GET', '/subscriptions', undefined, token)).subscriptions;
  assert.equal(groups.length, 1); assert.equal(groups[0].kind, 'node'); assert.equal(groups[0].url, '');
  assert.equal((await request('GET', `/subscription/${groups[0].id}/nodes`, undefined, token)).nodes.length, 1);
});

await run('real-check-sse-filter-and-selected-recheck', async (page, { token }) => {
  const created = await group(token);
  await configure(token);
  await request('POST', `/subscription/${created.id}/refresh`, undefined, token);
  await openGroup(page, created.id);
  await page.getByRole('button', { name: 'Check options', exact: true }).click();
  await page.getByRole('button', { name: 'Alive only', exact: true }).last().click();
  const started = await mutation(page, 'POST', `/check/${created.id}`, () => page.getByRole('button', { name: 'Start check', exact: true }).click());
  await poll(async () => {
    const { jobs } = await request('GET', `/check/${created.id}/jobs`, undefined, token);
    assert.equal(jobs.find(job => job.id === started.job_id)?.status, 'completed');
  });
  await page.getByPlaceholder('Filter nodes…').waitFor();
  await page.getByPlaceholder('Filter nodes…').fill('Alpha');
  await page.getByRole('checkbox', { name: 'Select Fixture Alpha', exact: true }).check();
  const next = await mutation(page, 'POST', `/check/${created.id}`, () => page.getByRole('button', { name: 'Check selected (1)', exact: true }).click());
  await poll(async () => {
    const { jobs } = await request('GET', `/check/${created.id}/jobs`, undefined, token);
    const job = jobs.find(item => item.id === next.job_id);
    assert.equal(job?.status, 'completed'); assert.equal(job?.total, 1);
  });
  await page.reload();
  await page.getByRole('button', { name: 'Node group actions' }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('sub'), created.id);
});

await run('scheduler-create-edit-toggle-delete', async (page, { token }) => {
  const created = await group(token, 'Scheduled browser group');
  await page.goto(origin + '/scheduler');
  await page.getByRole('button', { name: 'New schedule', exact: true }).first().click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Node group' }).click();
  await page.getByRole('option', { name: created.name, exact: true }).click();
  await dialog.getByRole('button', { name: 'Daily 4:00', exact: true }).click();
  await dialog.getByRole('button', { name: 'Alive only', exact: true }).click();
  const schedule = await mutation(page, 'POST', '/scheduler', () => dialog.getByRole('button', { name: 'Create', exact: true }).click());
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: `Edit schedule for ${created.name}`, exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Every 12h', exact: true }).click();
  const updated = await mutation(page, 'POST', '/scheduler', () => dialog.getByRole('button', { name: 'Save', exact: true }).click());
  assert.equal(updated.id, schedule.id);
  await dialog.waitFor({ state: 'hidden' });
  await mutation(page, 'PATCH', `/scheduler/${schedule.id}`, () => page.getByRole('switch', { name: `Enable schedule for ${created.name}` }).click());
  assert.equal((await request('GET', '/scheduler', undefined, token)).jobs[0].enabled, false);
  await page.getByRole('button', { name: `Delete schedule for ${created.name}` }).click();
  await mutation(page, 'DELETE', `/scheduler/${schedule.id}`, () => page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click());
  assert.equal((await request('GET', '/scheduler', undefined, token)).jobs.length, 0);
});

await run('settings-and-export-tags-persist-after-reload', async (page, { token }) => {
  await page.goto(origin + '/settings/general');
  await page.getByLabel('Latency test URL', { exact: true }).fill(fixture + '/health');
  await page.getByLabel('Download test URL', { exact: true }).fill(fixture + '/download');
  await page.getByLabel('Upload test URL (optional)', { exact: true }).fill(fixture + '/upload');
  await page.getByLabel('SMTP host', { exact: true }).fill('127.0.0.1');
  await page.getByLabel('SMTP port', { exact: true }).fill('18082');
  await page.getByLabel('From address', { exact: true }).fill('browser@example.invalid');
  await mutation(page, 'PUT', '/settings', () => page.getByRole('button', { name: 'Save settings', exact: true }).click());
  await page.reload();
  await poll(async () => assert.equal(await page.getByLabel('SMTP host', { exact: true }).inputValue(), '127.0.0.1'));
  await page.goto(origin + '/settings/export-tags');
  const country = page.getByRole('switch', { name: 'Detected country', exact: true });
  await country.waitFor();
  const prior = await country.getAttribute('aria-checked');
  await country.click();
  await mutation(page, 'PUT', '/settings', () => page.getByRole('button', { name: 'Save export tags', exact: true }).click());
  assert.equal((await request('GET', '/settings', undefined, token)).export_tags.show_country, prior !== 'true');
  await page.reload();
  await poll(async () => assert.equal(await country.getAttribute('aria-checked'), prior === 'true' ? 'false' : 'true'));
});

await run('profile-password-validation-and-save', async (page, { token, username }) => {
  await page.goto(origin + '/settings/account');
  await page.getByLabel('Display name', { exact: true }).fill('Browser profile');
  await page.getByLabel('Email', { exact: true }).fill('browser@example.invalid');
  await mutation(page, 'PATCH', '/auth/profile', () => page.getByRole('button', { name: 'Save profile' }).click());
  assert.equal((await request('GET', '/auth/me', undefined, token)).display_name, 'Browser profile');
  await page.getByLabel('Current password', { exact: true }).fill(password);
  await page.getByLabel('New password', { exact: true }).fill(password + '-new');
  await page.getByLabel('Confirm new password', { exact: true }).fill('does-not-match');
  await page.getByRole('button', { name: 'Change password' }).click();
  await page.getByRole('alert').filter({ hasText: 'Passwords do not match' }).waitFor();
  await page.getByLabel('Confirm new password', { exact: true }).fill(password + '-new');
  await mutation(page, 'POST', '/auth/change-password', () => page.getByRole('button', { name: 'Change password' }).click());
  await request('POST', '/auth/login', { username, password }, undefined, 401);
  await request('POST', '/auth/login', { username, password: password + '-new' });
});

await run('api-key-confirmation-copy-and-revocation', async (page, { token }, context) => {
  await page.goto(origin + '/settings/export');
  const oldKey = (await request('GET', '/settings/api-key', undefined, token)).api_key;
  await page.getByRole('button', { name: 'Regenerate', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal((await request('GET', '/settings/api-key', undefined, token)).api_key, oldKey);
  await page.getByRole('button', { name: 'Regenerate', exact: true }).click();
  const { api_key: newKey } = await mutation(page, 'POST', '/settings/api-key/regenerate', () => page.getByRole('dialog').getByRole('button', { name: 'Regenerate', exact: true }).click());
  assert.notEqual(newKey, oldKey);
  await request('GET', `/export/all?token=${oldKey}`, undefined, undefined, 401);
  await request('GET', `/export/all?token=${newKey}`);
  await page.getByRole('button', { name: 'Copy to clipboard', exact: true }).first().click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), newKey);
});

await run('notification-create-deliver-failure-edit-delete', async (page, { token }) => {
  await page.goto(origin + '/settings/notify');
  await page.getByRole('button', { name: 'Add channel', exact: true }).first().click();
  let dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('My alerts').fill('Browser notifications');
  await dialog.getByPlaceholder('https://…').fill(fixture + '/hook');
  const created = await mutation(page, 'POST', '/notify/channels', () => dialog.getByRole('button', { name: 'Create', exact: true }).click());
  await dialog.waitFor({ state: 'hidden' });
  const delivered = await mutation(page, 'POST', `/notify/channels/${created.id}/test`, () => page.getByRole('button', { name: 'Test', exact: true }).click());
  assert.equal(delivered.ok, true);
  const events = await (await fetch(fixture + '/events')).json();
  assert.ok(events.events.some(event => event.type === 'webhook'));
  await page.getByRole('button', { name: /Browser notifications/ }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('https://…').fill(fixture + '/fail');
  await mutation(page, 'PUT', `/notify/channels/${created.id}`, () => dialog.getByRole('button', { name: 'Save', exact: true }).click());
  await dialog.waitFor({ state: 'hidden' });
  const failed = await mutation(page, 'POST', `/notify/channels/${created.id}/test`, () => page.getByRole('button', { name: 'Test', exact: true }).click());
  assert.equal(failed.ok, false);
  await page.locator('[data-sonner-toast][data-type="error"]').filter({ hasText: /503/ }).waitFor();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await mutation(page, 'DELETE', `/notify/channels/${created.id}`, () => page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click());
  assert.equal((await request('GET', '/notify/channels', undefined, token)).channels.length, 0);
});

await run('condition-rule-test-save-edit-and-confirm-delete', async (page, { token }) => {
  await page.goto(origin + '/rules');
  await page.getByRole('button', { name: 'New rule', exact: true }).click();
  await page.getByPlaceholder('Rule name', { exact: true }).fill('Browser condition');
  await page.getByPlaceholder('key', { exact: true }).fill('browser_condition');
  await page.getByRole('button', { name: 'Condition', exact: true }).click();
  await page.getByLabel('URL (required)', { exact: true }).fill(fixture + '/platform');
  await page.getByLabel('Expected status (0 = any)', { exact: true }).fill('200');
  await page.getByLabel('Body contains ALL (comma-separated)', { exact: true }).fill('available');
  const tested = await mutation(page, 'POST', '/platform-rules/test', () => page.getByRole('button', { name: 'Run test', exact: true }).click());
  assert.equal(tested.ok, true);
  const created = await mutation(page, 'POST', '/platform-rules', () => page.getByRole('button', { name: 'Create rule', exact: true }).click());
  await page.getByRole('button', { name: 'Save changes', exact: true }).waitFor();
  await page.getByPlaceholder('Rule name', { exact: true }).fill('Edited condition');
  await mutation(page, 'PUT', `/platform-rules/${created.id}`, () => page.getByRole('button', { name: 'Save changes', exact: true }).click());
  assert.equal((await request('GET', '/platform-rules', undefined, token)).rules.find(r => r.id === created.id)?.name, 'Edited condition');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete rule', exact: true }).click();
  assert.ok((await request('GET', '/platform-rules', undefined, token)).rules.some(r => r.id === created.id));
  page.once('dialog', dialog => dialog.accept());
  await mutation(page, 'DELETE', `/platform-rules/${created.id}`, () => page.getByRole('button', { name: 'Delete rule', exact: true }).click());
  assert.ok(!(await request('GET', '/platform-rules', undefined, token)).rules.some(r => r.id === created.id));
});

await run('mobile-navigation-theme-and-layout', async (page, { token }) => {
  await group(token, 'Mobile group');
  await page.reload();
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Scheduler', exact: true }).click();
  await page.getByRole('heading', { name: 'Scheduler', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.setViewportSize({ width: 320, height: 740 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '320px document overflow');
  const before = await page.locator('html').getAttribute('class');
  await page.getByRole('button', { name: /Switch to .* mode/ }).click();
  assert.notEqual(await page.locator('html').getAttribute('class'), before);
  await page.screenshot({ path: path.join(output, 'mobile-settings-real-backend.png'), fullPage: true });
}, { mobile: true });

await browser.close();
await writeFile(path.join(output, 'report.json'), JSON.stringify({ mode: 'real browser → Nitro /api → Encore → PostgreSQL; external providers use loopback fixtures', checks, passed: checks.filter(c => c.status === 'passed').length, failed: checks.filter(c => c.status === 'failed').length }, null, 2) + '\n');
if (checks.some(check => check.status !== 'passed')) process.exitCode = 1;
