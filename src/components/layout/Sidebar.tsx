import { SidebarContent } from '@/components/layout/SidebarContent';

/**
 * 桌面端固定侧边栏（≥ md）
 *
 * 移动端不渲染（hidden md:flex），由 MobileNav 提供 Sheet 抽屉。
 */
export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-border bg-card md:flex">
      <SidebarContent />
    </aside>
  );
}
