from pathlib import Path

def change(file, old, new):
    p = Path(file)
    s = p.read_text()
    assert old in s, file + ': source changed; refusing an ambiguous patch'
    p.write_text(s.replace(old, new, 1))

change('services/scheduler/scheduler.go', 'id := uuid.New().String()\n\tif _, err := db.Exec(ctx, `', 'id := uuid.New().String()\n\tvar createdAt time.Time\n\tif err := db.QueryRow(ctx, `')
change('services/scheduler/scheduler.go', 'ON CONFLICT (subscription_id) DO UPDATE SET cron_expr = $5, sub_url = $4, options_json = $6, enabled = true\n\t`, id, p.SubscriptionID, claims.UserID, sub.URL, p.CronExpr, optsJSON, time.Now()); err != nil {', 'ON CONFLICT (subscription_id) DO UPDATE SET cron_expr = $5, sub_url = $4, options_json = $6, enabled = true\n\t\tRETURNING id, created_at\n\t`, id, p.SubscriptionID, claims.UserID, sub.URL, p.CronExpr, optsJSON, time.Now()).Scan(&id, &createdAt); err != nil {')
change('services/scheduler/scheduler.go', '\t\tDebug:           opts.Debug,\n\t}, nil', '\t\tDebug:           opts.Debug,\n\t\tCreatedAt:       createdAt,\n\t}, nil')
p = Path('services/settings/settings.go')
s = p.read_text()
a = s.index('\tvar key string', s.index('func GetAPIKey'))
b = s.index('\treturn &APIKeyResponse', a)
s = s[:a] + '''\t// Atomic get-or-create: a concurrent GET must never rotate an existing key.
\tvar key string
\terr := db.QueryRow(ctx, `
\t\tINSERT INTO user_settings (user_id, api_key) VALUES ($1, $2)
\t\tON CONFLICT (user_id) DO UPDATE
\t\tSET api_key = COALESCE(NULLIF(user_settings.api_key, ''), EXCLUDED.api_key)
\t\tRETURNING api_key
\t`, claims.UserID, uuid.New().String()).Scan(&key)
\tif err != nil {
\t\treturn nil, errs.B().Code(errs.Internal).Msg("failed to read API key").Err()
\t}
''' + s[b:]
p.write_text(s)
change('services/notify/notify.go', '\tupdAlerts := p.PlatformAlerts\n\tif updAlerts == nil {\n\t\tupdAlerts = []string{}\n\t}\n\tupdAlertsJSON, _ := json.Marshal(updAlerts)', '\t// Omission preserves alerts; an explicit empty array clears them.\n\tvar updAlertsJSON []byte\n\tif p.PlatformAlerts != nil {\n\t\tupdAlertsJSON, _ = json.Marshal(p.PlatformAlerts)\n\t}')
change('services/notify/notify.go', 'platform_alerts   = $8::jsonb', 'platform_alerts   = COALESCE($8::jsonb, platform_alerts)')
p = Path('services/checker/rules.go')
s = p.read_text().replace('authsvc "subs-check-re/services/auth"', 'authsvc "subs-check-re/services/auth"\n\tsubsvc "subs-check-re/services/subscription"')
a = s.index('\tclaims :=', s.index('func ListTestNodes'))
b = s.index('\n}\n', a)
s = s[:a] + '''\towned, err := subsvc.List(ctx)
\tif err != nil { return nil, err }
\tids := make([]string, 0, len(owned.Subscriptions))
\tfor _, sub := range owned.Subscriptions { ids = append(ids, sub.ID) }
\tif len(ids) == 0 { return &ListTestNodesResponse{Nodes: []*NodeSummary{}}, nil }
\trows, err := db.Query(ctx, `
\t\tSELECT n.id, n.name, COALESCE(n.type, ''), COALESCE(n.config::text, '')
\t\tFROM nodes n WHERE n.subscription_id = ANY($1::text[])
\t\tORDER BY n.name, n.id LIMIT 500
\t`, ids)
\tif err != nil { return nil, errs.B().Code(errs.Internal).Msg("failed to list test nodes").Err() }
\tdefer rows.Close()
\tnodes := []*NodeSummary{}
\tfor rows.Next() {
\t\tvar n NodeSummary
\t\tif err := rows.Scan(&n.ID, &n.Name, &n.Type, &n.Config); err != nil {
\t\t\treturn nil, errs.B().Code(errs.Internal).Msg("failed to read test node").Err()
\t\t}
\t\tnodes = append(nodes, &n)
\t}
\tif err := rows.Err(); err != nil { return nil, errs.B().Code(errs.Internal).Msg("failed to list test nodes").Err() }
\treturn &ListTestNodesResponse{Nodes: nodes}, nil''' + s[b:]
p.write_text(s)
p = Path('services/checker/rule_eval.go')
s = p.read_text().replace('"time"', '"time"\n\n\t"encore.dev/beta/errs"\n\t"encore.dev/storage/sqldb"\n\tsubsvc "subs-check-re/services/subscription"')
s = s.replace('httpClient, nodeName, cleanup := openTestClient(ctx, userID, nodeID)', 'httpClient, nodeName, cleanup, err := openTestClient(ctx, userID, nodeID)\n\tif err != nil { return nil, err }')
a = s.index('// openTestClient')
b = s.index('\nfunc runConditionTest', a)
s = s[:a] + '''// openTestClient never silently falls back to direct access for an explicit node.
// Ownership comes from its subscription, including nodes not checked yet.
func openTestClient(ctx context.Context, userID, nodeID string) (*http.Client, string, func(), error) {
\tif nodeID == "" { return &http.Client{Timeout: 15 * time.Second}, "", nil, nil }
\tvar name, subscriptionID string
\tvar configJSON []byte
\terr := db.QueryRow(ctx, `SELECT name, subscription_id, config FROM nodes WHERE id=$1`, nodeID).Scan(&name, &subscriptionID, &configJSON)
\tif err == sqldb.ErrNoRows { return nil, "", nil, errs.B().Code(errs.NotFound).Msg("test node not found").Err() }
\tif err != nil { return nil, "", nil, errs.B().Code(errs.Internal).Msg("failed to load test node").Err() }
\tsub, err := subsvc.GetSubscriptionByID(ctx, &subsvc.GetByIDParams{ID: subscriptionID})
\tif err != nil || sub.UserID != userID { return nil, "", nil, errs.B().Code(errs.NotFound).Msg("test node not found").Err() }
\tvar mapping map[string]any
\tif err := json.Unmarshal(configJSON, &mapping); err != nil {
\t\treturn nil, "", nil, errs.B().Code(errs.InvalidArgument).Msg("invalid test node configuration").Err()
\t}
\tpc := newProxyClient(mapping)
\tif pc == nil { return nil, "", nil, errs.B().Code(errs.InvalidArgument).Msg("unsupported test node configuration").Err() }
\treturn pc.Client, name, func() { pc.close() }, nil
}
''' + s[b:]
p.write_text(s)
change('frontend/src/lib/client.ts', '\tif (isAPIError(err) && err.status === 401) {\n\t\tclearToken();', '\tif (isAPIError(err) && err.status === 401) {\n\t\tif (typeof window !== "undefined" && window.location.pathname === "/login") return false;\n\t\tclearToken();')
Path('frontend/src/components/form-field.tsx').write_text('''import { cloneElement, useId, type ReactElement, type ComponentPropsWithRef } from "react";
import { Label } from "@/components/ui/label";

type Control = ComponentPropsWithRef<"input">;
export function FormField({ label, error, children }: { label: string; error?: string; children: ReactElement<Control> }) {
\tconst generated = useId();
\tconst id = children.props.id ?? generated;
\tconst description = [children.props["aria-describedby"], error ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined;
\treturn <div className="space-y-1.5">
\t\t<Label htmlFor={id} className="text-xs">{label}</Label>
\t\t{cloneElement(children, { id, "aria-describedby": description, "aria-invalid": error ? true : children.props["aria-invalid"] })}
\t\t{error && <p id={`${id}-error`} role="alert" className="text-danger text-xs">{error}</p>}
\t</div>;
}
''')
for file in ['account', 'general']:
    p = Path(f'frontend/src/routes/settings/{file}.tsx')
    s = p.read_text().replace('import { Label } from "@/components/ui/label";', 'import { FormField as Field } from "@/components/form-field";')
    a = s.index('function Field(')
    b = s.index('\nfunction ', a + 9)
    p.write_text(s[:a] + s[b:])
p = Path('frontend/src/components/platforms/ConditionEditor.tsx')
s = p.read_text().replace('export function ConditionEditor', 'import { FormField as FL } from "@/components/form-field";\n\nexport function ConditionEditor')
p.write_text(s[:s.index('\nfunction FL(')])
change('frontend/src/components/schedule-dialog.tsx', '<SelectTrigger className="w-full">', '<SelectTrigger aria-label="Node group" className="w-full">')
p = Path('frontend/src/routes/settings/export-tags.tsx')
s = p.read_text().replace('checked={showCountry}', 'aria-label="Detected country" checked={showCountry}').replace('checked={showSpeed}', 'aria-label="Speed" checked={showSpeed}').replace('checked={t?.enabled ?? true}', 'aria-label={`Include ${labelFor(key)} tag`} checked={t?.enabled ?? true}').replace('<Label className="w-28', '<Label htmlFor={`export-tag-${key}`} className="w-28').replace('value={t?.label ?? ""}', 'id={`export-tag-${key}`} value={t?.label ?? ""}')
p.write_text(s)
