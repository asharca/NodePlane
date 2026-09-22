import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './utils';
export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div {...props} aria-hidden="true" className={cn('rounded-lg bg-muted motion-safe:animate-pulse', className)} />;
}
