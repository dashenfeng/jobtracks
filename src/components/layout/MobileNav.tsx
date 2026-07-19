'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { SidebarContent } from '@/components/layout/SidebarContent';

/**
 * 移动端导航抽屉（< md）
 *
 * - 汉堡按钮在 Header 左侧（md:hidden）
 * - 点击打开 Sheet（左滑出），内容复用 SidebarContent
 * - 路由切换后自动关闭（usePathname 监听）
 * - 点击导航链接后自动关闭（onNavigate 回调）
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 路由变化后关闭抽屉
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="打开导航菜单"
      >
        <Menu className="size-5" />
      </Button>
      <SheetContent
        side="left"
        className="w-64 p-0 sm:max-w-none"
        showClose={false}
      >
        {/* a11y：Radix Dialog 要求有 Title，这里用 sr-only 满足要求 */}
        <SheetTitle className="sr-only">导航菜单</SheetTitle>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
