import type { ReactNode } from 'react';
import { Badge, type BadgeProps } from './badge';
import { cn } from './utils';

export interface StatusBadgeProps extends BadgeProps { label: ReactNode; dot?: boolean; appearance?: 'badge' | 'plain' }
export function StatusBadge({ label, dot = true, appearance = 'badge', className, ...props }: StatusBadgeProps) {
  return <Badge {...props} className={cn(appearance === 'plain' && 'border-transparent bg-transparent px-0', className)}>{dot && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />}{label}</Badge>;
}
