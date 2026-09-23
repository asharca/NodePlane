'use client';
import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from './utils';
export interface SectionProps extends Omit<ComponentPropsWithoutRef<'section'>, 'title'> { title: ReactNode; count?: number; actions?: ReactNode; description?: ReactNode }
export function Section({ title, count, actions, description, className, children, ...props }: SectionProps) {
  const id = useId();
  return <section aria-labelledby={id} {...props} className={cn('space-y-4', className)}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id={id} className="flex items-center gap-2 text-sm font-semibold">{title}{count !== undefined && <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-normal text-muted-foreground">{count}</span>}</h2>{description && <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>{children}</section>;
}
