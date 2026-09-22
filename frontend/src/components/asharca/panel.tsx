'use client';
import { useId, type ReactNode } from 'react';
import { cn } from './utils';
export interface PanelProps { title: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode; tone?: 'default' | 'danger'; className?: string }
export function Panel({ title, description, actions, children, tone = 'default', className }: PanelProps) {
  const id = useId();
  return <section aria-labelledby={id} className={cn('overflow-hidden rounded-2xl border border-border bg-background', tone === 'danger' && 'border-destructive/30', className)}>
    <header className="border-b border-border px-5 py-4"><h2 id={id} className={cn('text-sm font-semibold', tone === 'danger' && 'text-destructive')}>{title}</h2>{description && <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>}</header>
    {children && <div className="p-5 text-sm">{children}</div>}{actions && <footer className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3">{actions}</footer>}
  </section>;
}
