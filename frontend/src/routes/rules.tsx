import { createFileRoute } from "@tanstack/react-router";
import { Plus, Radar } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMonacoSetup } from "@/components/platforms/engine";
import { RuleInspector } from "@/components/platforms/RuleInspector";
import { RuleListPane } from "@/components/platforms/RuleListPane";
import { RequestError } from "@/components/request-state";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useRules } from "@/queries";
export const Route = createFileRoute("/rules")({ component: RulesPage });
function RulesPage() {
	useMonacoSetup();
	const rulesQuery = useRules();
	const rules = rulesQuery.data?.rules ?? [];
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [draft, setDraft] = useState(false);
	useEffect(() => { if (selectedId && !rules.some((rule) => rule.id === selectedId)) setSelectedId(null); }, [rules, selectedId]);
	const didAutoSelect = useRef(false);
	useEffect(() => {
		if (!didAutoSelect.current && rules.length > 0 && !selectedId && !draft && typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) { didAutoSelect.current = true; setSelectedId(rules[0].id); }
	}, [rules, selectedId, draft]);
	const selected = rules.find((rule) => rule.id === selectedId) ?? null;
	const showInspector = draft || !!selected;
	const startNew = () => { setDraft(true); setSelectedId(null); };
	const select = (id: string) => { setSelectedId(id); setDraft(false); };
	const close = () => { setDraft(false); setSelectedId(null); };
	const handleSaved = (id: string) => { setDraft(false); setSelectedId(id); };
	if (rulesQuery.isLoading) return <div aria-busy="true" className="grid h-full gap-5 p-5 lg:grid-cols-[280px_1fr]"><Skeleton className="h-full rounded-xl" /><Skeleton className="hidden h-full rounded-xl lg:block" /></div>;
	if (rulesQuery.isError && !rulesQuery.data) return <RequestError title="Platform rules could not be loaded" onRetry={() => void rulesQuery.refetch()} retrying={rulesQuery.isFetching} />;
	return <div className="flex h-full min-h-0 flex-col"><div className="flex h-full min-h-0">
		<div className={["min-h-0 w-full border-border/70 bg-card/60 lg:w-[280px] lg:shrink-0 lg:border-r", showInspector ? "hidden lg:flex" : "flex"].join(" ")}><RuleListPane rules={rules} selectedId={selectedId} onSelect={select} onNew={startNew} /></div>
		<div className={["min-h-0 min-w-0 flex-1", showInspector ? "flex" : "hidden lg:flex"].join(" ")}>{draft ? <RuleInspector onClose={close} onSaved={handleSaved} onMobileBack={close} /> : selected ? <RuleInspector key={selected.id} rule={selected} onClose={close} onSaved={handleSaved} onMobileBack={close} /> : <div className="flex min-w-0 flex-1 items-center justify-center p-4 sm:p-8"><EmptyState icon={Radar} title={rules.length === 0 ? "Define your first detection rule" : "Inspect a platform rule"} description={rules.length === 0 ? "Built-in rules seed automatically. Create a rule to detect a custom platform." : "Choose a rule to review its conditions, edit its script and test a response."} className="w-full max-w-lg bg-muted/20 py-12" action={<Button onClick={startNew}><Plus className="size-4" />Create rule</Button>} /></div>}</div>
	</div></div>;
}
