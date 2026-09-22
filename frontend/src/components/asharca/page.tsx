import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './utils';

export interface PageProps extends ComponentPropsWithoutRef<'div'> { as?: 'main' | 'div' }
export function Page({ as: Tag = 'main', className, ...props }: PageProps) { return <Tag {...props} className={cn('mx-auto w-full max-w-6xl space-y-6 p-5 sm:p-7', className)} />; }
export interface PageHeaderProps { title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode; back?: ReactNode; headingLevel?: 1 | 2 }
export function PageHeader({ title, description, actions, meta, back, headingLevel = 1 }: PageHeaderProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return <header className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0">{back && <div className="mb-3 text-xs">{back}</div>}<div className="flex flex-wrap items-center gap-3"><Heading className="text-xl font-semibold tracking-tight">{title}</Heading>{meta}</div>{description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</header>;
}
