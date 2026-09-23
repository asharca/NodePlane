from pathlib import Path


def change(file, old, new):
    p = Path(file)
    value = p.read_text()
    assert old in value, f'{file}: source changed; refusing ambiguous replacement'
    p.write_text(value.replace(old, new))


change('services/checker/rule_eval.go', '"encoding/json"', '"encoding/json"\n\t"errors"\n\n\t"github.com/google/uuid"')
change('services/checker/rule_eval.go', '\tvar name, subscriptionID string', '\tif _, err := uuid.Parse(nodeID); err != nil {\n\t\treturn nil, "", nil, errs.B().Code(errs.NotFound).Msg("test node not found").Err()\n\t}\n\tvar name, subscriptionID string')
change('services/checker/rule_eval.go', 'if err == sqldb.ErrNoRows {', 'if errors.Is(err, sqldb.ErrNoRows) {')
change('tests/functional_api.py', '"node_id": "missing-test-node"}, expected=404)', '"node_id": "missing-test-node"}, expected=404)\n        self.api("POST", "/platform-rules/test", {"rule_type": "condition", "definition": {"url": FIXTURE + "/platform", "status_code": 200}, "node_id": "00000000-0000-0000-0000-000000000000"}, expected=404)')
p = Path('frontend/src/queries/subscriptions.ts')
s = p.read_text()
a = s.index('\t\tmutationFn: async (args:', s.index('export function useCreateNodeGroup'))
b = s.index('\n\t\tonSuccess:', a)
s = s[:a] + '\t\tmutationFn: createNodeGroup,' + s[b:]
helper = '''export async function createNodeGroup(args: {
\tparams: subscription.CreateParams;
\tnodeContent?: string;
}) {
\tconst content = args.nodeContent?.trim();
\tif (args.params.kind === "node" && !content) {
\t\tthrow new Error("Paste one node share link");
\t}
\tconst group = await client.subscription.Create(args.params);
\tif (content) {
\t\ttry {
\t\t\tawait client.checker.ImportNodes(group.id, { content, append: true });
\t\t} catch (importError) {
\t\t\t// Compensate only for the group created by this operation, never for an
\t\t\t// existing group. Do not report success if cleanup also fails.
\t\t\ttry { await client.subscription.Delete(group.id); }
\t\t\tcatch (cleanupError) {
\t\t\t\tthrow new AggregateError([importError, cleanupError], `Import and cleanup failed. Remove node group ${group.id} before retrying.`);
\t\t\t}
\t\t\tthrow importError;
\t\t}
\t}
\treturn group;
}

'''
s = s.replace('export function useCreateNodeGroup()', helper + 'export function useCreateNodeGroup()')
p.write_text(s)
change('frontend/src/components/workbench/subscription-dialog.tsx', 'toast.error(isApiError(e) ? e.message : "Request failed")', 'toast.error(e instanceof Error ? e.message : isApiError(e) ? e.message : "Request failed")')
p = Path('frontend/scripts/functional-browser.mjs')
s = p.read_text()
a = s.index('async function mutation(')
b = s.index('\nasync function login(', a)
s = s[:a] + '''async function mutation(page, method, endpoint, action, expected = 200, readBody = true) {
  // Attach rejection handlers to both promises immediately. A failed locator
  // must not create an unhandled response-timeout rejection and abort reporting.
  const [response] = await Promise.all([
    page.waitForResponse(r => r.request().method() === method && new URL(r.url()).pathname === `/api${endpoint}`),
    action(),
  ]);
  assert.equal(response.status(), expected, `${method} ${endpoint}`);
  if (!readBody) return undefined; // void endpoints have no JSON response body
  const error = await response.finished();
  assert.equal(error, null, `${method} ${endpoint}: incomplete response`);
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}
''' + s[b:]
s = s.replace('await page.getByRole(\'button\', { name: \'Change password\' }).click());', 'await page.getByRole(\'button\', { name: \'Change password\' }).click(), 200, false);') if False else s
old = "await mutation(page, 'POST', '/auth/change-password', () => page.getByRole('button', { name: 'Change password' }).click());"
assert old in s
s = s.replace(old, "await mutation(page, 'POST', '/auth/change-password', () => page.getByRole('button', { name: 'Change password' }).click(), 200, false);")
s = s.replace("await page.getByRole('button', { name: 'Regenerate', exact: true }).click();", "await page.locator('#main-content').getByRole('button', { name: 'Regenerate', exact: true }).click();")
s = s.replace("await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();\n  assert.equal((await request('GET', '/settings/api-key'", "await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();\n  await page.getByRole('dialog').waitFor({ state: 'hidden' });\n  assert.equal((await request('GET', '/settings/api-key'")
s = s.replace("await dialog.getByRole('button', { name: 'Add group', exact: true }).click();\n  await page.getByText('Request failed', { exact: true }).waitFor({ timeout: 1500 }).catch(() => {});", "const [rejected] = await Promise.all([\n    page.waitForResponse(r => r.request().method() === 'POST' && /\\/api\\/subscription\\/[^/]+\\/import-nodes$/.test(new URL(r.url()).pathname)),\n    dialog.getByRole('button', { name: 'Add group', exact: true }).click(),\n  ]);\n  assert.equal(rejected.status(), 400);")
s = s.replace("await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true }).catch(() => {});", "await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true }).catch(() => {});\n    await writeFile(path.join(output, name + '.html'), await page.content()).catch(() => {});")
# Preserve an incremental report even if a later browser crashes.
s = s.replace('} finally { await context.close(); }', "} finally {\n    await writeFile(path.join(output, 'report.json'), JSON.stringify({ mode: 'real backend', checks, passed: checks.filter(c => c.status === 'passed').length, failed: checks.filter(c => c.status === 'failed').length }, null, 2) + '\\n');\n    await context.close();\n  }")
p.write_text(s)
change('tests/check_docs.py', "DOCS = [ROOT / 'README.md', ROOT / 'docs/testing.md']", "DOCS = [ROOT / 'README.md', ROOT / 'docs/testing.md', ROOT / 'frontend/README.md']")
change('.github/workflows/backend-ci.yml', '      - name: Configure disposable local application', '      - name: Validate README links and committed screenshots\n        run: python3 tests/check_docs.py\n      - name: Configure disposable local application')
