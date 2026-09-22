'use client';

import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ContextMenu as Context } from 'radix-ui';
import { ArrowLeft, ArrowRight, ExternalLink, MoreHorizontal, Pin, PinOff, Plus, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';
import { IconButton } from './icon-button';
import { cn, focusRing } from './utils';

export interface WorkspaceTab {
  id: string;
  title: string;
  icon?: ReactNode;
  pinned?: boolean;
  dirty?: boolean;
  /** 禁止关闭该标签；固定标签和最后一个标签也不会触发 onClose。 */
  closable?: boolean;
  /** false 时禁用此标签的独立窗口选项。 */
  detachable?: boolean;
  /** 标签按钮的 DOM id，用于面板的 aria-labelledby。 */
  tabId?: string;
  /** 对应内容面板的 DOM id。 */
  panelId?: string;
}
export interface WorkspaceTabBarProps {
  variant?: 'default' | 'inset';
  tabs: WorkspaceTab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
  onReorder?: (sourceId: string, targetId: string) => void;
  onPinnedChange?: (id: string, pinned: boolean) => void;
  /** 菜单同步调用；宿主使用真实页面 URL 打开独立窗口，处理状态和拦截失败。 */
  onOpenInNewWindow?: (id: string) => void;
  /** 标签条末尾的 + 按钮。 */
  onNewTab?: () => void;
  /** 标签条右侧的固定操作区，不跟随标签横向滚动。 */
  actions?: ReactNode;
  /** 与浏览器标签相似的中键关闭；仍遵循固定、最后一项和 closable 约束。 */
  closeOnMiddleClick?: boolean;
  /** 默认关闭，避免双击选择文字时误关；可按宿主需求启用。 */
  closeOnDoubleClick?: boolean;
  className?: string;
}

/** 标签菜单同时支持 ⋯、右键、长按和 Shift+F10；布局不接管页面路由。 */
export function WorkspaceTabBar({
  tabs, activeTabId, onSelect, onClose, onReorder, onPinnedChange, onOpenInNewWindow,
  onNewTab, actions, closeOnMiddleClick = true, closeOnDoubleClick = false,
  variant = 'default', className,
}: WorkspaceTabBarProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const [menuTab, setMenuTab] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closing = useRef<string | null>(null);
  const inset = variant === 'inset';
  const hasMenu = Boolean(onReorder || onPinnedChange || onOpenInNewWindow || onClose);
  const canClose = (tab: WorkspaceTab) => Boolean(onClose && !tab.pinned && tab.closable !== false && tabs.length > 1);

  useLayoutEffect(() => {
    if (closing.current && !tabs.some((tab) => tab.id === closing.current)) {
      closing.current = null;
      if (document.activeElement === document.body || scrollRef.current?.contains(document.activeElement)) {
        (refs.current.get(activeTabId) ?? refs.current.get(tabs[0]?.id))?.focus({ preventScroll: true });
      }
    }
    if (!inset) return;
    const scroller = scrollRef.current;
    const active = refs.current.get(activeTabId)?.parentElement;
    if (!scroller || !active) return;
    const viewport = scroller.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    if (tab.left < viewport.left) scroller.scrollLeft += tab.left - viewport.left;
    else if (tab.right > viewport.right) scroller.scrollLeft += tab.right - viewport.right;
  }, [activeTabId, tabs, inset]);

  function close(tab: WorkspaceTab) {
    if (!canClose(tab)) return;
    closing.current = tab.id;
    onClose?.(tab.id);
  }
  function move(source: WorkspaceTab, target: WorkspaceTab | undefined) {
    if (!target || source.id === target.id || Boolean(source.pinned) !== Boolean(target.pinned)) return;
    onReorder?.(source.id, target.id);
    refs.current.get(source.id)?.focus({ preventScroll: true });
  }
  function selectAt(index: number) {
    const target = tabs[(index + tabs.length) % tabs.length];
    if (target) { onSelect(target.id); refs.current.get(target.id)?.focus({ preventScroll: true }); }
  }
  function menuActions(tab: WorkspaceTab, index: number) {
    const items: { key: string; label: string; icon: ReactNode; disabled?: boolean; run: () => void }[] = [];
    if (onOpenInNewWindow) items.push({ key: 'detach', label: '在独立窗口打开', icon: <ExternalLink />, disabled: tab.detachable === false, run: () => onOpenInNewWindow(tab.id) });
    if (onPinnedChange) items.push({ key: 'pin', label: tab.pinned ? '取消固定' : '固定标签', icon: tab.pinned ? <PinOff /> : <Pin />, run: () => onPinnedChange(tab.id, !tab.pinned) });
    if (onReorder) {
      items.push({ key: 'left', label: '向左移动', icon: <ArrowLeft />, disabled: !tabs[index - 1] || Boolean(tabs[index - 1].pinned) !== Boolean(tab.pinned), run: () => move(tab, tabs[index - 1]) });
      items.push({ key: 'right', label: '向右移动', icon: <ArrowRight />, disabled: !tabs[index + 1] || Boolean(tabs[index + 1].pinned) !== Boolean(tab.pinned), run: () => move(tab, tabs[index + 1]) });
    }
    if (onClose) items.push({ key: 'close', label: '关闭标签', icon: <X />, disabled: !canClose(tab), run: () => close(tab) });
    return items;
  }

  return <div data-slot="workspace-tab-strip" className={cn('flex max-w-full min-w-0 shrink-0 items-end', !inset && 'bg-muted/20', className)}>
    <div ref={scrollRef} data-slot="workspace-tab-bar" data-variant={variant} data-leading-active={inset && tabs[0]?.id === activeTabId}
      className={cn('max-w-full min-w-0 flex-1 overflow-x-auto overscroll-x-contain', inset ? 'bg-transparent [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'border-b border-border bg-muted/20')}>
      <div role="tablist" aria-label="工作区标签" className={cn('flex min-w-max gap-1', inset ? 'h-11 items-end pt-1' : 'items-center p-1.5')}>
        {tabs.map((tab, index) => {
          const items = menuActions(tab, index);
          const restoreFocus = (event: Event) => {
            event.preventDefault();
            (refs.current.get(tab.id) ?? refs.current.get(activeTabId) ?? refs.current.get(tabs[0]?.id))?.focus({ preventScroll: true });
          };
          const row = <div data-slot="workspace-tab" data-active={tab.id === activeTabId} className={cn(
            'group relative flex shrink-0 items-center',
            inset ? 'h-10 rounded-t-[var(--workspace-radius,0.75rem)] px-1 pb-0.5' : 'rounded-lg border border-transparent',
            tab.id === activeTabId && (inset
              ? 'bg-[var(--workspace-surface,var(--background))] before:pointer-events-none before:absolute before:bottom-0 before:-left-2 before:size-2 before:bg-[radial-gradient(circle_at_top_left,transparent_70%,var(--workspace-surface,var(--background))_72%)] first:before:hidden after:pointer-events-none after:absolute after:bottom-0 after:-right-2 after:size-2 after:bg-[radial-gradient(circle_at_top_right,transparent_70%,var(--workspace-surface,var(--background))_72%)]'
              : 'border-border bg-background shadow-sm'),
          )}
            draggable={Boolean(onReorder)} onDragStart={(event) => { event.dataTransfer.setData('text/plain', tab.id); event.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(event) => { if (onReorder) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const source = tabs.find((item) => item.id === event.dataTransfer.getData('text/plain')); if (source) move(source, tab); }}>
            <button ref={(node) => { if (node) refs.current.set(tab.id, node); else refs.current.delete(tab.id); }} id={tab.tabId} aria-controls={tab.panelId} type="button" role="tab" aria-selected={tab.id === activeTabId}
              tabIndex={tab.id === activeTabId || !tabs.some((item) => item.id === activeTabId) && index === 0 ? 0 : -1}
              aria-keyshortcuts={hasMenu ? 'Shift+F10' : undefined}
              onClick={() => onSelect(tab.id)} onAuxClick={(event) => { if (event.button === 1 && closeOnMiddleClick) { event.preventDefault(); close(tab); } }}
              onDoubleClick={() => { if (closeOnDoubleClick) close(tab); }}
              onKeyDown={(event) => {
                if (hasMenu && (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10')) {
                  event.preventDefault(); event.stopPropagation(); setMenuTab(tab.id); return;
                }
                if (event.key === 'Delete') { event.preventDefault(); close(tab); return; }
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
                  const step = (event.key === 'ArrowLeft' ? -1 : 1) * (rtl ? -1 : 1);
                  if (event.altKey) move(tab, tabs[index + step]); else selectAt(index + step);
                }
                if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); selectAt(event.key === 'Home' ? 0 : tabs.length - 1); }
              }} className={cn('flex h-8 max-w-48 items-center gap-2 rounded-lg px-2.5 text-xs text-muted-foreground aria-selected:text-foreground', focusRing)}>
              {tab.icon && <span aria-hidden="true" className="inline-flex [&_svg]:size-3.5">{tab.icon}</span>}
              {tab.pinned && <Pin aria-hidden="true" className="size-3" />}
              <span className="truncate" title={tab.title}>{tab.title}</span>
              {tab.dirty && <span aria-label="未保存" className="size-1.5 rounded-full bg-current" />}
            </button>
            {hasMenu && <DropdownMenu open={menuTab === tab.id} onOpenChange={(open) => setMenuTab(open ? tab.id : null)}>
              <DropdownMenuTrigger asChild><IconButton label={`${tab.title}操作`} icon={<MoreHorizontal />} className="size-6" /></DropdownMenuTrigger>
              <DropdownMenuContent align="start" onCloseAutoFocus={restoreFocus}>{items.map((item) => <DropdownMenuItem key={item.key} disabled={item.disabled} onSelect={item.run}>{item.icon}{item.label}</DropdownMenuItem>)}</DropdownMenuContent>
            </DropdownMenu>}
            {onClose && !tab.pinned && <IconButton label={`关闭 ${tab.title}`} icon={<X />} disabled={!canClose(tab)} className="mr-1 size-6" onClick={() => close(tab)} />}
          </div>;
          return hasMenu ? <Context.Root key={tab.id}>
            <Context.Trigger asChild>{row}</Context.Trigger>
            <Context.Portal><Context.Content collisionPadding={12} onCloseAutoFocus={restoreFocus} className="z-50 min-w-44 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg">
              {items.map((item) => <Context.Item key={item.key} disabled={item.disabled} onSelect={item.run} className="flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-3.5">{item.icon}{item.label}</Context.Item>)}
            </Context.Content></Context.Portal>
          </Context.Root> : <Fragment key={tab.id}>{row}</Fragment>;
        })}
      </div>
    </div>
    {(onNewTab || actions) && <div data-slot="workspace-tab-actions" className={cn('flex shrink-0 items-center gap-1 pl-1', inset ? 'h-11' : 'h-12')}>
      {onNewTab && <IconButton label="新建标签" icon={<Plus />} onClick={onNewTab} />}{actions}
    </div>}
  </div>;
}
