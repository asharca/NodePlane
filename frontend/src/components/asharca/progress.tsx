import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './utils';

export interface ProgressProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> { label: string; value?: number; max?: number; showValue?: boolean }
export function Progress({ label, value, max = 100, showValue = true, className, ...props }: ProgressProps) {
  const limit = Number.isFinite(max) && max > 0 ? max : 100;
  const current = value === undefined || !Number.isFinite(value) ? undefined : Math.max(0, Math.min(limit, value));
  const percent = current === undefined ? undefined : Math.round(current / limit * 100);
  return <div className={cn('grid w-full gap-2.5', className)}>
    <div className="flex justify-between gap-4 text-xs"><span>{label}</span>{showValue && <span className="font-mono text-muted-foreground">{percent === undefined ? '进行中…' : `${percent}%`}</span>}</div>
    <div {...props} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={current} className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-300', current === undefined && 'motion-safe:animate-pulse')} style={{ width: percent === undefined ? '35%' : `${percent}%` }} />
    </div>
  </div>;
}
