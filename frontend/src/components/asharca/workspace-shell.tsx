'use client';

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from './utils';

export interface WorkspaceShellProps extends ComponentPropsWithRef<'div'> {
  /** 应用导航。搭配 WorkspaceSidebar variant="inset"；折叠状态由应用管理。 */
  sidebar?: ReactNode;
  /** 面板外的标签栏，与正文共用左右留白，不再叠加圆角大小作为缩进。 */
  tabBar?: ReactNode;
  /** 小屏导航入口，仅在 sm 以下显示。 */
  mobileHeader?: ReactNode;
  /** 内容面板内的固定标题或工具栏。 */
  header?: ReactNode;
  /** 内容面板内的固定底部，可放状态栏或聊天输入框。 */
  footer?: ReactNode;
  /** content：正文独立滚动；none：由聊天、编辑器等子组件管理滚动。 */
  scroll?: 'content' | 'none';
  /** 正文 DOM 属性、ref、className 和可访问性关联；不额外创建 main 地标。 */
  contentProps?: Omit<ComponentPropsWithRef<'div'>, 'children'>;
}
function hasSlot(node: ReactNode) { return node != null && typeof node !== 'boolean'; }

/**
 * 共享底色上的内嵌式工作区。外层需明确高度，例如 className="h-dvh"。
 * --workspace-shell-background、--workspace-surface 控制背景；--workspace-radius 控制圆角。
 * 默认外侧留白为 8px，桌面有侧栏时左侧不重复加留白，保证收起后的图标到内容边界同样居中。
 * 显式设置 --workspace-gap 可统一覆盖所有边距；标签栏与正文始终使用同一条左右对齐线。
 * 不接管路由、持久化或未保存确认，弹出页面由 WorkspaceTabBar 的 onOpenInNewWindow 接入。
 */
export function WorkspaceShell({ sidebar, tabBar, mobileHeader, header, footer, scroll = 'content', contentProps, children, className, ...props }: WorkspaceShellProps) {
  // Like ToolPlane's desktop ml-0: a second left inset would make a centered
  // icon rail LOOK off-center against the adjacent content card. Mobile and
  // layouts without a sidebar retain the normal outer inset. An explicitly
  // configured gap remains an opt-in uniform override for existing consumers.
  const sidebarInset = hasSlot(sidebar) && 'sm:ml-[var(--workspace-gap,0px)]';
  return <div {...props} data-slot="workspace-shell" className={cn('flex h-full w-full min-h-0 min-w-0 overflow-hidden bg-[var(--workspace-shell-background,var(--muted))] text-foreground', className)}>
    {sidebar}
    <div data-slot="workspace-body" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {hasSlot(mobileHeader) && <div data-slot="workspace-mobile-header" className="flex min-h-14 shrink-0 items-center gap-3 px-3 sm:hidden">{mobileHeader}</div>}
      {hasSlot(tabBar) && <div data-slot="workspace-shell-tabs" className={cn('peer/workspace-tabs mx-[var(--workspace-gap,0.5rem)] min-w-0 shrink-0', sidebarInset)}>{tabBar}</div>}
      <div data-slot="workspace-surface" className={cn(
        'm-[var(--workspace-gap,0.5rem)] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--workspace-radius,0.75rem)] bg-[var(--workspace-surface,var(--background))]',
        sidebarInset,
        hasSlot(tabBar) && 'mt-0 peer-has-[[data-leading-active=true]]/workspace-tabs:rounded-tl-none',
      )}>
        {hasSlot(header) && <div data-slot="workspace-shell-header" className="min-w-0 shrink-0">{header}</div>}
        <div {...contentProps} data-slot="workspace-content" data-scroll={scroll} className={cn('min-h-0 min-w-0 flex-1', scroll === 'content' ? 'overflow-auto overscroll-contain' : 'flex flex-col overflow-hidden', contentProps?.className)}>{children}</div>
        {hasSlot(footer) && <div data-slot="workspace-shell-footer" className="min-w-0 shrink-0">{footer}</div>}
      </div>
    </div>
  </div>;
}

/**
 * 在用户点击的同步回调中打开同源页面。被浏览器拦截时返回 null，不应移除原标签。
 * prepare 可在导航前同步写入该标签的最小状态；不要传递凭据或整个应用状态。
 * 浏览器可能自动复制 opener 的 sessionStorage；需要隔离时，在 prepare 中清理或筛选子窗口副本，
 * 再写入最小快照。工具不会自动清空宿主可能依赖的登录状态；示例使用独立的最小快照。
 * 新窗口在导航前清除 opener；prepare 或导航失败会关闭空白窗口并抛错。
 * 页面必须有可直接访问的路由；刷新恢复、原标签移除和未保存确认由宿主负责。
 * 浏览器最终可能选择新标签页而不是独立窗口。
 */
export function openWorkspaceWindow(href: string | URL, prepare?: (popup: Window) => void): Window | null {
  const url = new URL(href, window.location.href);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== window.location.origin || url.username || url.password) {
    throw new Error('工作区窗口必须使用不含凭据的同源 HTTP(S) 地址。');
  }
  const popup = window.open('about:blank', '_blank', 'popup,width=1100,height=760');
  if (!popup) return null;
  try {
    popup.opener = null;
    prepare?.(popup);
    popup.location.replace(url.href);
    return popup;
  } catch (error) {
    popup.close();
    throw error;
  }
}
