from pathlib import Path


def change(path, old, new):
    p = Path(path)
    value = p.read_text()
    assert old in value, f'{path}: expected source not found'
    p.write_text(value.replace(old, new))


change('services/checker/engine_tengo.go', 'Example: output :=', 'Example: output =')
change('services/checker/engine_tengo.go', 'fullCode := "output := false\\n" + def.Prelude + "\\n" + def.Code', 'fullCode := def.Prelude + "\\n" + def.Code')
change('services/checker/engine_lua.go', 'L := lua.NewState()\n\tdefer L.Close()', 'L := lua.NewState()\n\tdefer L.Close()\n\tL.SetContext(ctx)')
change('services/checker/engine_script.go', '\tval, err := vm.RunString(wrapped)', '''\t// Goja does not automatically observe context cancellation while running JS.
\tfinished := make(chan struct{})
\tdefer close(finished)
\tgo func() {
\t\tselect {
\t\tcase <-ctx.Done():
\t\t\tvm.Interrupt(ctx.Err())
\t\tcase <-finished:
\t\t}
\t}()
\tval, err := vm.RunString(wrapped)''')
# Query struct fields are PascalCase in TypeScript, but wire names are explicit
# lower-case query tags. FailedPrecondition maps to HTTP 400 in Encore.
change('tests/functional_api.py', '?Limit=', '?limit=')
change('tests/functional_api.py', '&Offset=', '&offset=')
change('tests/functional_api.py', '?JobID=', '?job_id=')
change('tests/functional_api.py', 'expected=412', 'expected=400')
change('tests/functional_api.py', 'self.assertIn(node["node_id"], [n["id"] for n in picker])', '''self.assertIn(node["node_id"], [n["id"] for n in picker])
        _, _, other = user()
        self.api("POST", "/platform-rules/test", {"rule_type": "condition", "definition": {"url": FIXTURE + "/platform", "status_code": 200}, "node_id": node["node_id"]}, token=other, expected=404)
        self.api("POST", "/platform-rules/test", {"rule_type": "condition", "definition": {"url": FIXTURE + "/platform", "status_code": 200}, "node_id": "missing-test-node"}, expected=404)''')
p = Path('tests/functional_api.py')
s = p.read_text()
extra = '''    def test_network_unlock_and_unlock_notification(self):
        # CI redirects ip-api.com to a loopback fixture; only user-owned local
        # rules are enabled here. No real platform service is contacted.
        for rule in self.api("GET", "/platform-rules")["rules"]:
            self.api("PUT", f'/platform-rules/{rule["id"]}', {**rule, "enabled": False})
        self.rule("local_fixture")
        result = self.api("GET", "/network-unlock")
        self.assertTrue(result["platforms"]["local_fixture"]["unlocked"])
        self.assertEqual(set(result["platforms"]), {"local_fixture"})
        self.assertEqual(result["ip"], "192.0.2.10")
        channel = self.api("POST", "/notify/channels", {"name": "Unlock fixture", "type": "webhook", "config": {"url": FIXTURE + "/hook"}})
        self.assertTrue(self.api("POST", f'/notify/channels/{channel["id"]}/test', {"report_type": "unlock"})["ok"])


'''
s = s.replace('if __name__ == "__main__":', extra + 'if __name__ == "__main__":')
p.write_text(s)
for file in ['frontend/src/components/workbench/run-check-button.tsx', 'frontend/src/components/workbench/detail-pane.tsx']:
    change(file, '(e.status === 409 || e.status === 412)', '(e.code === "failed_precondition" || e.status === 409 || e.status === 412)')
change('frontend/src/queries/notify.ts', '''\t\tmutationFn: (args: { id: string; params: notify.TestChannelParams }) =>
\t\t\tclient.notify.TestChannel(args.id, args.params),''', '''\t\tmutationFn: async (args: { id: string; params: notify.TestChannelParams }) => {
\t\t\tconst result = await client.notify.TestChannel(args.id, args.params);
\t\t\tif (!result.ok) throw new Error(result.error || "Notification delivery failed");
\t\t\treturn result;
\t\t},''')
change('frontend/src/routes/settings/notify.tsx', 'toast.error(isApiError(e) ? e.message : "Test failed")', 'toast.error(e instanceof Error ? e.message : "Test failed")')
change('frontend/scripts/functional-browser.mjs', "name: 'Copy', exact: true", "name: 'Copy to clipboard', exact: true")
# The clipboard operation must finish successfully before reporting success.
p = Path('frontend/src/components/copy-button.tsx')
p.write_text('''import { CopyButton as AsharcaCopyButton } from "@/components/asharca/copy-button";
import { toast } from "sonner";

export function CopyButton({ text, className }: { text: string; className?: string }) {
\treturn <AsharcaCopyButton text={text} label="Copy to clipboard" iconOnly className={className}
\t\tonCopyResult={(success) => { if (!success) toast.error("Could not copy to clipboard"); }} />;
}
''')
