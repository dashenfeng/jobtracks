'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { navSections, everyNavItems } from '@/components/layout/nav-items';

/**
 * 侧边栏内容（Logo + 导航 + 底部设置链接）
 *
 * 桌面端 Sidebar 与移动端 MobileNav 共用此组件。
 * onNavigate 回调用于移动端点击导航后关闭 Sheet。
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();

  const allItems = everyNavItems;
  const matchedItem = allItems
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const activeHref = matchedItem?.href;

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex-shrink-0 border-b border-border px-5 py-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
          >
            <Sparkles size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-none text-foreground">职迹</h1>
            <p className="mt-3.5 text-xs leading-none text-muted-foreground">个人求职工作台</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-8">
        {navSections.map((section, sIdx) => (
          <div key={section.section} className={cn(sIdx > 0 && 'mt-10')}>
            <div className="my-3 px-3 text-[11px] font-semibold uppercase leading-none tracking-wider text-muted-foreground">
              {section.section}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = activeHref === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <item.icon size={18} className="flex-shrink-0" />
                    <span className="leading-none">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-border p-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Settings size={18} className="flex-shrink-0" />
          <span className="leading-none">设置</span>
        </Link>
      </div>
    </div>
  );
}
