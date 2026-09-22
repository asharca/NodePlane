import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './utils';
export interface EmptyStateProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> { title: ReactNode; description?: ReactNode; icon?: ReactNode; actions?: ReactNode }
export function EmptyState({ title, description, icon, actions, className, ...props }: EmptyStateProps) {
  return <div {...props} className={cn('flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center', className)}>
    {icon && <div aria-hidden="true" className="mb-4 grid size-11 place-items-center rounded-xl border border-border bg-background text-muted-foreground [&_svg]:size-5">{icon}</div>}
    <h3 className="text-sm font-medium">{title}</h3>{description && <p className="mt-2 max-w-xs text-xs leading-6 text-muted-foreground">{description}</p>}{actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
  </div>;
}
