'use client';

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import { Dialog as Primitive } from 'radix-ui';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn, pressSpring } from './utils';

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export interface DialogContentProps extends Omit<ComponentPropsWithoutRef<typeof Primitive.Content>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  portalContainer?: ComponentPropsWithoutRef<typeof Primitive.Portal>['container'];
}
export const DialogContent = forwardRef<ElementRef<typeof Primitive.Content>, DialogContentProps>(function DialogContent(
  { title, description, portalContainer, children, className, ...props }, ref,
) {
  const reduce = useReducedMotion();
  return <Primitive.Portal container={portalContainer}>
    <Primitive.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[3px]" />
    <Primitive.Content {...props} {...(!description ? { 'aria-describedby': undefined } : {})} ref={ref} asChild>
      <motion.div initial={reduce ? false : { opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={pressSpring}
        className={cn('fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-background p-6 text-foreground shadow-xl outline-none', className)}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0"><Primitive.Title className="text-lg font-semibold tracking-tight">{title}</Primitive.Title>{description && <Primitive.Description className="mt-2 text-sm leading-6 text-muted-foreground">{description}</Primitive.Description>}</div>
          <Primitive.Close asChild><Button variant="ghost" size="icon" aria-label="关闭对话框" className="-mr-2 -mt-2"><X className="size-4" /></Button></Primitive.Close>
        </div>
        {children}
      </motion.div>
    </Primitive.Content>
  </Primitive.Portal>;
});
