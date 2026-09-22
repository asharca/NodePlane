import type { ElementType, ReactNode } from "react";
import { EmptyState as AsharcaEmptyState } from "@/components/asharca/empty-state";
import { cn } from "@/lib/utils";
export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: ElementType; title: string; description?: string; action?: ReactNode; className?: string }) {
	return <AsharcaEmptyState icon={Icon ? <Icon /> : undefined} title={title} description={description} actions={action} className={cn("m-4 [&>p]:max-w-sm [&>p]:text-sm", className)} />;
}
