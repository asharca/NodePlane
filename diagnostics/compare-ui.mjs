import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';

// This harness never rewrites UI source or intercepts application API responses.
const BEFORE = 'e14cd39934656f8a6cff296d39097d041eb7a253';
const AFTER = '8879f24fce275ad3b4d55cee7cba3a91a0a3ceba';
const backend = 'http://127.0.0.1:4000';
const fixture = 'http://127.0.0.1:18081';
const origins = { before: 'http://127.0.0.1:3100', after: 'http://127.0.0.1:3200' };
assert.equal(process.env.NODEPLANE_E2E_DISPOSABLE, '1', 'Only run against disposable infrastructure');
const output = path.resolve(process.env.COMPARISON_OUTPUT || 'comparison-output');
const require = createRequire(path.join(process.env.PLAYWRIGHT_RUNTIME, 'package.json'));
const { chromium } = require('playwright');
await mkdir(output, { recursive: true });
for (const key of Object.keys(origins)) await mkdir(path.join(output, key), { recursive: true });
const report = {
  before_commit: BEFORE, after_commit: AFTER, backend_commit: AFTER,
  mode: 'Two unmodified production frontend builds; same real Encore backend and PostgreSQL; no API interception',
  data_scope: 'Disposable demonstration account. Proxy transport, IP lookup and target services are controlled loopback fixtures, not production nodes.',
  locale: 'en-US', timezone: 'UTC', device_scale_factor: 1,
  animation_policy: 'prefers-reduced-motion: reduce; Playwright screenshot animations disabled; still images do not evaluate motion quality',
  capture_policy: 'Uncropped fixed-viewport PNG, no injected style or UI source patch',
  workflow_run: process.env.GITHUB_RUN_ID, checks: [], seed_requests: [], comparisons: [],
};
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
let token;
async function api(method, endpoint, body, authenticated = true) {
  const response = await fetch(backend + endpoint, {
    method, headers: { 'Content-Type': 'application/json', ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000),
  });
  const text = await response.text();
  let value; try { value = JSON.parse(text); } catch { value = text; }
  report.seed_requests.push({ method, path: endpoint.split('?')[0], status: response.status });
  assert.equal(response.status, 200, `${method} ${endpoint}: ${response.status} ${text.slice(0, 300)}`);
  return value;
}
async function poll(fn, timeout = 50000) {
  const end = Date.now() + timeout;
  let error;
  while (Date.now() < end) {
    try { return await fn(); } catch (e) { error = e; }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw error || new Error('Polling deadline');
}
const username = 'nodeplane_demo';
const password = randomBytes(24).toString('base64url');
const invite = process.env.REGISTER_INVITE_CODE;
await api('POST', '/auth/register', { username, password, invite_code: invite }, false);
token = (await api('POST', '/auth/login', { username, password, remember: true }, false)).token;
await api('PATCH', '/auth/profile', { username, display_name: 'NodePlane Demo', email: 'demo@example.test' });
const settings = await api('GET', '/settings');
await api('PUT', '/settings', { ...settings, latency_test_url: fixture + '/health', speed_test_url: fixture + '/download', upload_test_url: fixture + '/upload' });
// Seed default definitions once, but only run our explicitly selected local rules.
await api('GET', '/platform-rules');
const rules = [];
for (const [i, name, key, body] of [[0, 'Local availability', 'local_availability', 'available'], [1, 'Local region', 'local_region', 'US']]) {
  rules.push(await api('POST', '/platform-rules', { name, key, rule_type: 'condition', enabled: true, sort_order: -20 + i,
    definition: { url: fixture + '/platform', status_code: 200, body_contains: [body] } }));
}
const groups = [];
for (const [i, name] of ['Primary / Lab A', 'Backup / Lab B', 'Paused / Archive', 'Direct / Local'].entries()) {
  groups.push(await api('POST', '/subscriptions', { kind: i === 3 ? 'node' : 'subscription', name, url: fixture + '/subscription.yaml?source=' + i }));
}
const primaryYaml = 'proxies:\n' + Array.from({ length: 6 }, (_, i) => '  - ' + JSON.stringify({
  name: `Lab relay ${String(i + 1).padStart(2, '0')}`, type: 'http', server: '127.0.0.1', port: i < 4 ? 18081 : 18089,
  username: `demo${i + 1}`, password: 'local-fixture-only',
})).join('\n') + '\n';
await api('POST', `/subscription/${groups[0].id}/import-nodes`, { content: primaryYaml, append: false });
assert.equal((await api('GET', `/subscription/${groups[0].id}/nodes`)).nodes.length, 6);
for (const group of groups.slice(1, 3)) await api('POST', `/subscription/${group.id}/refresh`);
await api('POST', `/subscription/${groups[3].id}/import-nodes`, { content: 'proxies:\n  - {name: "Direct fixture", type: http, server: localhost, port: 18081}\n', append: false });
await api('PUT', `/subscriptions/${groups[2].id}`, { enabled: false });
for (const [index, group] of groups.slice(0, 2).entries()) {
  const job = await api('POST', `/check/${group.id}`, { speed_test: index === 0, upload_speed_test: index === 0, media_apps: rules.map(r => r.key), debug: false });
  await poll(async () => {
    const found = (await api('GET', `/check/${group.id}/jobs`)).jobs.find(j => j.id === job.job_id);
    assert.equal(found?.status, 'completed');
  });
}
for (const [index, cron] of ['0 0 1 1 *', '30 3 1 1 *', '0 6 1 1 *'].entries()) {
  const schedule = await api('POST', '/scheduler', { subscription_id: groups[index].id, cron_expr: cron,
    options: { speed_test: true, upload_speed_test: false, media_apps: rules.map(r => r.key), debug: false } });
  if (index === 2) await api('PATCH', `/scheduler/${schedule.id}`, { enabled: false });
}
const readState = async () => ({
  groups: (await api('GET', '/subscriptions')).subscriptions,
  nodes: await Promise.all(groups.map(g => api('GET', `/subscription/${g.id}/nodes`))),
  schedules: (await api('GET', '/scheduler')).jobs,
  summaries: (await api('GET', '/check-summaries')).jobs,
});
const initialState = await readState();
report.dataset = { username, groups: groups.length, nodes: initialState.nodes.reduce((n, x) => n + x.nodes.length, 0), schedules: initialState.schedules.length,
  primary_nodes: initialState.nodes[0].nodes.map(n => ({ name: n.node_name, alive: n.alive, latency_ms: n.latency_ms, speed_kbps: n.speed_kbps, upload_speed_kbps: n.upload_speed_kbps })),
  state_sha256: hash(initialState), explanation: 'Seeded using real application APIs. Detection ran on local fixture proxies; results are not real-world performance benchmarks. Annual schedules avoid data changes during capture.' };
report.fixed_browser_time = new Date().toISOString();
const browser = await chromium.launch({ headless: true });
const specs = [
  { id: 'workspace-light', title: 'Workspace overview', route: '/', ready: 'Primary / Lab A' },
  { id: 'workspace-dark', title: 'Workspace overview / dark', route: '/', ready: 'Primary / Lab A', theme: 'dark' },
  { id: 'nodes-light', title: 'Node results', route: `/?sub=${groups[0].id}`, ready: 'Lab relay 01' },
  { id: 'nodes-dark', title: 'Node results / dark', route: `/?sub=${groups[0].id}`, ready: 'Lab relay 01', theme: 'dark' },
  { id: 'scheduler-light', title: 'Scheduled checks', route: '/scheduler', ready: 'Primary / Lab A' },
  { id: 'rules-light', title: 'Platform rule editor', route: '/rules', ready: 'Local availability', action: 'rule' },
  { id: 'settings-general', title: 'General settings', route: '/settings/general', ready: 'General' },
  { id: 'settings-account', title: 'Account settings', route: '/settings/account', ready: 'Account' },
  { id: 'create-group-dialog', title: 'Create node group', route: '/', ready: 'Primary / Lab A', action: 'dialog' },
  { id: 'login-light', title: 'Sign in', route: '/login', ready: 'Username', anonymous: true },
  { id: 'login-dark', title: 'Sign in / dark', route: '/login', ready: 'Username', anonymous: true, theme: 'dark' },
  { id: 'workspace-mobile', title: 'Mobile group list', route: '/', ready: 'Primary / Lab A', mobile: true },
  { id: 'nodes-mobile', title: 'Mobile node details', route: `/?sub=${groups[0].id}`, ready: 'Lab relay 01', mobile: true },
  { id: 'settings-mobile', title: 'Mobile settings', route: '/settings/general', ready: 'General', mobile: true },
];
try {
  for (const spec of specs) {
    const pair = { id: spec.id, title: spec.title, viewport: spec.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, theme: spec.theme || 'light', screenshots: {} };
    for (const variant of ['before', 'after']) {
      const context = await browser.newContext({ viewport: pair.viewport, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC', colorScheme: pair.theme, reducedMotion: 'reduce' });
      await context.addInitScript(({ theme, authToken }) => {
        localStorage.setItem('theme', theme);
        localStorage.removeItem('jwt_token');
        if (authToken) sessionStorage.setItem('jwt_token', authToken); else sessionStorage.removeItem('jwt_token');
      }, { theme: pair.theme, authToken: spec.anonymous ? null : token });
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date(report.fixed_browser_time));
      page.setDefaultTimeout(18000);
      const errors = [], requests = [], digestTasks = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.origin !== origins[variant] || !url.pathname.startsWith('/api/')) return;
        const entry = { method: response.request().method(), path: url.pathname, status: response.status() };
        requests.push(entry);
        if (entry.method === 'GET' && response.status() === 200 && !url.pathname.includes('progress') && !url.pathname.includes('api-key')) {
          digestTasks.push(response.text().then(body => { entry.sha256 = hash(body); }).catch(() => {}));
        }
      });
      try {
        const response = await page.goto(origins[variant] + spec.route, { waitUntil: 'networkidle', timeout: 45000 });
        assert.equal(response.status(), 200);
        await page.waitForFunction(text => document.body.innerText.includes(text), spec.ready);
        if (spec.action === 'dialog') {
          await page.getByRole('button', { name: 'Add node group', exact: true }).first().click();
          await page.getByRole('dialog').waitFor();
        }
        if (spec.action === 'rule') {
          const field = page.getByPlaceholder('Rule name', { exact: true });
          await field.waitFor();
          await poll(async () => assert.equal(await field.inputValue(), 'Local availability'), 15000);
          await page.getByText('URL (required)', { exact: true }).waitFor();
        }
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1200);
        assert.equal(await page.locator('html').evaluate(el => el.classList.contains('dark')), pair.theme === 'dark');
        const metrics = await page.evaluate(() => ({
          width: innerWidth, height: innerHeight, document_width: document.documentElement.scrollWidth,
          headings: Array.from(document.querySelectorAll('h1,h2,h3')).filter(el => el.getClientRects().length).map(el => el.textContent.trim()),
          body_text_length: document.body.innerText.length,
        }));
        const file = `${variant}/${spec.id}.png`;
        await page.screenshot({ path: path.join(output, file), fullPage: false, animations: 'disabled', caret: 'hide' });
        await Promise.race([Promise.allSettled(digestTasks), new Promise(resolve => setTimeout(resolve, 2000))]);
        pair.screenshots[variant] = { file, png_sha256: hash(await readFile(path.join(output, file))), metrics, page_errors: errors, requests };
        report.checks.push({ variant, page: spec.id, status: errors.length ? 'captured-with-page-errors' : 'passed' });
        console.log(`CAPTURED ${variant} ${spec.id} ${pair.viewport.width}x${pair.viewport.height}`);
      } catch (error) {
        report.checks.push({ variant, page: spec.id, status: 'failed', error: error.message, page_errors: errors, requests });
        await page.screenshot({ path: path.join(output, `${variant}/${spec.id}-failure.png`), fullPage: false }).catch(() => {});
        await writeFile(path.join(output, `${variant}/${spec.id}-failure.txt`), await page.locator('body').innerText().catch(() => '')).catch(() => {});
        console.error(`FAILED ${variant} ${spec.id}: ${error.stack}`);
      } finally { await context.close(); }
      await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    }
    pair.shared_response_checks = [];
    if (pair.screenshots.before && pair.screenshots.after) {
      for (const first of pair.screenshots.before.requests.filter(r => r.sha256)) {
        const second = pair.screenshots.after.requests.find(r => r.path === first.path && r.sha256);
        if (second) pair.shared_response_checks.push({ path: first.path, identical: first.sha256 === second.sha256 });
      }
    }
    report.comparisons.push(pair);
  }
  report.dataset_unchanged = hash(await readState()) === hash(initialState);
  assert.ok(report.dataset_unchanged, 'Data changed during paired screenshots');
} finally {
  await browser.close();
  report.completed_at = new Date().toISOString();
  report.passed = report.checks.filter(c => c.status === 'passed').length;
  report.failed = report.checks.filter(c => c.status !== 'passed').length;
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
assert.equal(report.failed, 0, 'Inspect individual failures in report.json');
console.log(`Finished ${report.comparisons.length} pairs, ${report.passed} screenshots; dataset unchanged=${report.dataset_unchanged}`);
