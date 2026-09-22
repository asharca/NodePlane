'use client';

import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Dialog as Primitive, Tooltip as TooltipPrimitive } from 'radix-ui';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { IconButton } from './icon-button';
import { cn, focusRing } from './utils';

export interface WorkspaceSidebarItem { id: string; label: string; icon?: ReactNode; badge?: ReactNode; href?: string; disabled?: boolean }
export interface WorkspaceSidebarGroup { id: string; title?: string; items: WorkspaceSidebarItem[] }
export interface WorkspaceSidebarProps {
  /** default：独立面板；inset：共享背景、18px 图标、36px 等宽图标轨道。 */
  variant?: 'default' | 'inset';
  groups: WorkspaceSidebarGroup[];
  activeId?: string;
  onSelect?: (id: string) => void;
  /** Controlled desktop state. Width and row height transition together; mobile stays expanded. */
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  title?: string;
  footer?: ReactNode;
  /** Width tokens: --workspace-sidebar-width (14rem), --workspace-sidebar-collapsed-width (4rem, at least 36px in inset mode). */
  className?: string;
}

const geometry = 'motion-safe:duration-200 motion-safe:ease-[ease-out] motion-reduce:transition-none';
const textFade = 'motion-safe:transition-opacity motion-safe:duration-[120ms] motion-safe:ease-[ease-out] motion-reduce:transition-none';

export function WorkspaceSidebar({ groups, activeId, onSelect, collapsed, onCollapsedChange, mobileOpen = false, onMobileOpenChange, title = '工作区', footer, variant = 'default', className }: WorkspaceSidebarProps) {
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    if (collapsed && footerRef.current?.contains(document.activeElement)) toggle.current?.focus();
  }, [collapsed]);

  function content(compact: boolean, mobile: boolean) {
    const fade = cn(textFade, compact ? 'opacity-0' : 'opacity-100');
    const inset = variant === 'inset' && !mobile;
    return <>
      <header data-slot="workspace-header" className={cn('flex h-14 shrink-0 items-center', inset ? 'px-[var(--workspace-sidebar-gutter)]' : 'border-b border-border px-3')}>
        <span data-slot="workspace-title" aria-hidden={compact || undefined} className={cn('min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold', fade)}>{title}</span>
        {mobile ? <Primitive.Close asChild><IconButton label="关闭工作区导航" icon={<X />} /></Primitive.Close> : <IconButton
          ref={toggle} label={compact ? '展开工作区侧栏' : '折叠工作区侧栏'} aria-expanded={!compact} aria-controls={`${id}-desktop-navigation`}
          className="w-[var(--workspace-icon-rail)] shrink-0"
          icon={<span className={cn('relative block', inset ? 'size-[18px] [&_svg]:size-[18px]' : 'size-4')}>
            <PanelLeftClose className={cn('absolute inset-0', fade)} />
            <PanelLeftOpen className={cn('absolute inset-0', textFade, compact ? 'opacity-100' : 'opacity-0')} />
          </span>}
          onClick={() => onCollapsedChange(!compact)} />}
      </header>
      <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={100}>
        <nav id={`${id}-${mobile ? 'mobile' : 'desktop'}-navigation`} aria-label={title} data-slot="workspace-nav" className={cn('min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', inset ? 'px-[var(--workspace-sidebar-gutter)]' : 'px-3')}>
          {groups.map((group) => <div key={group.id} data-slot="workspace-group" className="grid gap-1">
            {group.title && <p data-slot="workspace-group-title" aria-hidden={compact || undefined} className={cn('mb-1 h-4 overflow-hidden px-2 text-[10px] leading-4 whitespace-nowrap text-muted-foreground', fade)}>{group.title}</p>}
            {group.items.map((item) => {
              const cls = cn(
                'grid w-full shrink-0 grid-cols-[var(--workspace-icon-rail)_minmax(0,1fr)] items-center overflow-hidden p-0 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground motion-safe:transition-[height,border-radius,background-color,color]',
                geometry, focusRing, 'focus-visible:ring-inset focus-visible:ring-offset-0',
                compact ? 'h-9 rounded-[18px]' : 'h-10 rounded-lg',
                inset && 'hover:bg-background/60',
                activeId === item.id && (inset ? 'bg-[var(--workspace-surface,var(--background))] text-foreground' : 'bg-muted text-foreground'), item.disabled && 'cursor-not-allowed opacity-40',
              );
              const children = <>
                <span data-slot="workspace-icon" aria-hidden="true" className={cn('inline-grid shrink-0 place-items-center justify-self-center', inset ? 'size-[18px] [&_svg]:size-[18px]' : 'size-4 [&_svg]:size-4')}>{item.icon ?? <span className="size-1.5 rounded-full bg-current" />}</span>
                <span data-slot="workspace-label" aria-hidden={compact || undefined} className={cn('flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap pr-2.5', fade)}>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge !== undefined && <span data-slot="workspace-badge" className="shrink-0 text-[10px] text-muted-foreground">{item.badge}</span>}
                </span>
              </>;
              const choose = () => { onSelect?.(item.id); if (mobile) onMobileOpenChange?.(false); };
              const attributes = { 'data-slot': 'workspace-item', 'data-item-id': item.id, 'aria-label': item.label, 'aria-current': activeId === item.id ? 'page' as const : undefined, className: cls, onClick: choose };
              return <TooltipPrimitive.Root key={item.id}>
                <TooltipPrimitive.Trigger asChild>
                  {item.href && !item.disabled ? <a {...attributes} href={item.href}>{children}</a> : <button {...attributes} type="button" disabled={item.disabled}>{children}</button>}
                </TooltipPrimitive.Trigger>
                {compact && <TooltipPrimitive.Portal><TooltipPrimitive.Content side="right" sideOffset={10} collisionPadding={12} className="z-[60] max-w-64 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">{item.label}<TooltipPrimitive.Arrow className="fill-popover" /></TooltipPrimitive.Content></TooltipPrimitive.Portal>}
              </TooltipPrimitive.Root>;
            })}
          </div>)}
        </nav>
      </TooltipPrimitive.Provider>
      {footer && <div ref={mobile ? undefined : footerRef} data-slot="workspace-footer" aria-hidden={compact || undefined} inert={compact} className={cn('shrink-0 overflow-hidden py-3', inset ? 'px-[var(--workspace-sidebar-gutter)]' : 'border-t border-border px-3')}>
        <div className={cn(mobile ? 'w-full' : inset ? 'w-[calc(var(--workspace-sidebar-width,14rem)-2*var(--workspace-sidebar-gutter))]' : 'w-[calc(var(--workspace-sidebar-width,14rem)-1.5rem-var(--workspace-sidebar-border,1px))]', fade)}>{footer}</div>
      </div>}
    </>;
  }

  return <>
    <aside aria-label={`${title}侧栏`} data-slot="workspace-sidebar" data-variant={variant} data-collapsed={collapsed}
      className={cn('hidden h-full min-h-0 w-[var(--workspace-sidebar-width,14rem)] shrink-0 flex-col overflow-hidden sm:flex data-[collapsed=true]:w-[var(--workspace-sidebar-collapsed-width,4rem)] motion-safe:transition-[width]',
        variant === 'inset'
          ? '[--workspace-sidebar-border:0px] [--workspace-icon-rail:2.25rem] [--workspace-sidebar-gutter:calc((var(--workspace-sidebar-collapsed-width,4rem)_-_2.25rem)/2)] bg-[var(--workspace-shell-background,var(--muted))]'
          : '[--workspace-sidebar-border:1px] [--workspace-icon-rail:calc(var(--workspace-sidebar-collapsed-width,4rem)_-_1.5rem_-_var(--workspace-sidebar-border,1px))] border-r border-border bg-background',
        geometry, className)}>
      {content(collapsed, false)}
    </aside>
    <Primitive.Root open={mobileOpen} onOpenChange={onMobileOpenChange}>
      <AnimatePresence>
        {mobileOpen && <Primitive.Portal key="workspace-drawer" forceMount>
          <Primitive.Overlay forceMount asChild><motion.div data-slot="workspace-backdrop" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.16 }} className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]" /></Primitive.Overlay>
          <Primitive.Content forceMount asChild aria-describedby={undefined}
            onOpenAutoFocus={() => { returnFocus.current = document.activeElement as HTMLElement | null; }}
            onCloseAutoFocus={(event) => { event.preventDefault(); if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); }}>
            <motion.div data-slot="workspace-drawer" initial={reduce ? false : { x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: reduce ? 0 : 0.2, ease: 'easeOut' }} className="fixed inset-y-0 left-0 z-50 flex w-[min(19rem,calc(100vw-2rem))] flex-col overflow-hidden border-r border-border bg-background text-foreground shadow-xl outline-none [--workspace-icon-rail:2.5rem]">
              <Primitive.Title className="sr-only">{title}导航</Primitive.Title>{content(false, true)}
            </motion.div>
          </Primitive.Content>
        </Primitive.Portal>}
      </AnimatePresence>
    </Primitive.Root>
  </>;
}
