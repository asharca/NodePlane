'use client';

import { createContext, forwardRef, useContext, useId, useState, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { Tabs as Primitive } from 'radix-ui';
import { motion, useReducedMotion } from 'motion/react';
import { cn, focusRing, pressSpring } from './utils';

const TabContext = createContext<{ id: string; value?: string } | null>(null);
export const Tabs = forwardRef<ElementRef<typeof Primitive.Root>, ComponentPropsWithoutRef<typeof Primitive.Root>>(function Tabs(
  { value, defaultValue, onValueChange, ...props }, ref,
) {
  const id = useId();
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  return <TabContext.Provider value={{ id, value: current }}><Primitive.Root {...props} ref={ref} value={current} onValueChange={(next) => { setInternal(next); onValueChange?.(next); }} /></TabContext.Provider>;
});
export const TabsList = forwardRef<ElementRef<typeof Primitive.List>, ComponentPropsWithoutRef<typeof Primitive.List>>(function TabsList({ className, ...props }, ref) {
  return <Primitive.List {...props} ref={ref} className={cn('inline-flex max-w-full items-center gap-1 rounded-xl bg-muted p-1', className)} />;
});
export const TabsTrigger = forwardRef<ElementRef<typeof Primitive.Trigger>, ComponentPropsWithoutRef<typeof Primitive.Trigger>>(function TabsTrigger({ className, value, children, ...props }, ref) {
  const context = useContext(TabContext);
  const reduce = useReducedMotion();
  if (!context) throw new Error('TabsTrigger must be rendered inside Tabs.');
  return <Primitive.Trigger {...props} ref={ref} value={value} className={cn('relative isolate inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm text-muted-foreground data-[state=active]:text-foreground disabled:pointer-events-none disabled:opacity-45', focusRing, className)}>
    {context.value === value && <motion.span aria-hidden="true" layoutId={`tab-${context.id}`} transition={reduce ? { duration: 0 } : pressSpring} className="absolute inset-0 -z-10 rounded-lg bg-background shadow-sm" />}
    {children}
  </Primitive.Trigger>;
});
export const TabsContent = forwardRef<ElementRef<typeof Primitive.Content>, ComponentPropsWithoutRef<typeof Primitive.Content>>(function TabsContent({ className, ...props }, ref) {
  return <Primitive.Content {...props} ref={ref} className={cn('mt-4 rounded-xl text-sm leading-6', focusRing, className)} />;
});
