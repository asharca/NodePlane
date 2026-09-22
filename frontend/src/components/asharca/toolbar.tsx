import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './utils';
export interface ToolbarProps extends ComponentPropsWithoutRef<'div'> { actions?: ReactNode }
export function Toolbar({ actions, children, className, ...props }: ToolbarProps) {
  return <div {...props} className={cn('flex w-full flex-wrap items-center justify-between gap-3', className)}><div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}</div>;
}
