import { LoaderCircle } from 'lucide-react';
import { cn } from './utils';
export function Spinner({ label, className }: { label?: string; className?: string }) {
  return <span role={label ? 'status' : undefined} aria-hidden={label ? undefined : true} className={cn('inline-flex items-center gap-2 text-xs text-muted-foreground', className)}>
    <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />{label && <span>{label}</span>}
  </span>;
}
