import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './utils';

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> { tone?: 'neutral' | 'success' | 'warning' | 'error' }
const tones = {
  neutral: 'border-border bg-muted/60 text-muted-foreground',
  success: 'border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-600/20 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  error: 'border-red-600/20 bg-red-500/10 text-red-700 dark:text-red-300',
};
export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return <span {...props} className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium leading-none', tones[tone], className)} />;
}
