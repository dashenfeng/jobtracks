'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Search, Bell, Settings, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

import { everyNavItems, subPageLabels } from '@/components/layout/nav-items';
import { MobileNav } from '@/components/layout/MobileNav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Crumb = { label: string; active?: boolean };

/**
 * 根据当前路径计算面包屑。
 *
 * 规则：
 * 1. 从 everyNavItems 中按最长前缀匹配找到顶级项，得到 group + label
 *    例如 /applications/analytics → group=工作台, label=数据分析
 * 2. 若 pathname 比匹配的 href 长，则视为子页：
 *    - 先用 subPageLabels 匹配已知后缀（如 /logs、/interviews）
 *    - 否则若剩余路径是单个动态段（如 [id]），显示"详情"
 * 3. settings 等独立项无 group，只显示单项
 */
function useCrumbs(): Crumb[] {
  const pathname = usePathname();
  if (!pathname || pathname === '/') return [];

  const matched = everyNavItems
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (!matched) return [{ label: '未知页面', active: true }];

  const crumbs: Crumb[] = [];
  if (matched.group) crumbs.push({ label: matched.group });

  // 恰好是顶级页面
  if (pathname === matched.href) {
    crumbs.push({ label: matched.label, active: true });
    return crumbs;
  }

  // 子页：先显示父级 label，再补子页标签
  crumbs.push({ label: matched.label });

  const rest = pathname.slice(matched.href.length); // 如 "/logs"、"/abc-123"、"/abc-123/interviews"
  const segments = rest.split('/').filter(Boolean);

  if (segments.length === 0) {
    crumbs[crumbs.length - 1].active = true;
    return crumbs;
  }

  // 已知后缀
  const known = subPageLabels.find((s) => s.suffix.test(rest));
  if (known) {
    crumbs.push({ label: known.label, active: true });
    return crumbs;
  }

  // 多段：如 /applications/[id]/interviews
  if (segments.length >= 2) {
    const last = `/${segments[segments.length - 1]}`;
    const knownLast = subPageLabels.find((s) => s.suffix.test(last));
    if (knownLast) {
      crumbs.push({ label: '详情' });
      crumbs.push({ label: knownLast.label, active: true });
      return crumbs;
    }
  }

  // 单个动态段
  crumbs.push({ label: '详情', active: true });
  return crumbs;
}

export function Header() {
  const crumbs = useCrumbs();

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3 pl-1 sm:pl-3">
        {/* 移动端汉堡菜单（< md） */}
        <MobileNav />
        <nav aria-label="面包屑" className="text-sm">
          {crumbs.length === 0 ? (
            <span className="text-muted-foreground">首页</span>
          ) : (
            crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <span key={`${c.label}-${i}`} className="text-muted-foreground">
                  {i > 0 && <span className="mx-2 text-muted-foreground/50">/</span>}
                  <span className={isLast ? 'text-foreground' : ''}>{c.label}</span>
                </span>
              );
            })
          )}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent">
          <Search size={16} />
          <span>搜索...</span>
          <kbd className="ml-4 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            ⌘K
          </kbd>
        </div>

        {/* Notifications */}
        <button className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Bell size={20} />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2 border-background bg-destructive" />
        </button>

        {/* Avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
              aria-label="账号菜单"
            >
              F
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>我的账号</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <Settings size={14} />
                <span>设置</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 text-destructive focus:text-destructive"
              onClick={() => signOut({ callbackUrl: '/login', redirect: true })}
            >
              <LogOut size={14} />
              <span>退出登录</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
