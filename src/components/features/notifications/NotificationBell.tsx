'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Trash2, Loader2, Inbox, CalendarClock, ArrowRightLeft } from 'lucide-react';
import { NotificationType } from '@prisma/client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

interface ListResponse {
  items: NotificationItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  unreadCount: number;
}

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  INTERVIEW_REMINDER: CalendarClock,
  STATUS_CHANGED: ArrowRightLeft,
};

const TYPE_BADGE: Record<NotificationType, { label: string; variant: 'default' | 'secondary' }> = {
  INTERVIEW_REMINDER: { label: '面试', variant: 'default' },
  STATUS_CHANGED: { label: '状态', variant: 'secondary' },
};

/**
 * 通知铃铛 + 列表
 *
 * - 桌面：Popover 下拉
 * - 移动：Sheet 左滑出（侧边抽屉，和移动端导航保持一致）
 * - 30 秒轮询未读数（轻量，只读 unreadCount 字段）
 * - 点击通知：标记已读 + 跳转 link
 * - 全部已读 / 清空（清空会删所有通知，已读未读都删）
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // 拉取通知列表（打开时 + 操作后）
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?pageSize=20');
      if (!res.ok) return;
      const json: ListResponse = await res.json();
      setData(json);
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, []);

  // 轮询未读数（不打开时也跑，30 秒一次）
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/notifications?pageSize=1');
        if (!res.ok) return;
        const json: ListResponse = await res.json();
        if (!cancelled) {
          setData((prev) => {
            if (prev) return { ...prev, unreadCount: json.unreadCount };
            return { ...json, items: [] };
          });
        }
      } catch {
        // 静默
      }
    }
    poll();
    const t = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // 打开时拉取完整列表
  useEffect(() => {
    if (open) loadList();
  }, [open, loadList]);

  async function handleClick(n: NotificationItem) {
    // 乐观更新：立即标已读
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((it) => (it.id === n.id ? { ...it, read: true } : it)),
            unreadCount: Math.max(0, prev.unreadCount - (n.read ? 0 : 1)),
          }
        : prev,
    );
    if (!n.read) {
      fetch(`/api/notifications/${n.id}`, { method: 'PATCH' }).catch(() => {});
    }
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  async function handleMarkAllRead() {
    if (!data || data.unreadCount === 0) return;
    setBusy(true);
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAll() {
    if (!data || data.items.length === 0) return;
    if (!confirm('确定清空所有通知吗？此操作不可恢复。')) return;
    setBusy(true);
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all' }),
      });
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteOne(id: string) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.filter((it) => it.id !== id),
            total: Math.max(0, prev.total - 1),
            unreadCount: Math.max(0, prev.unreadCount - (prev.items.find((it) => it.id === id)?.read ? 0 : 1)),
          }
        : prev,
    );
    fetch(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  const unreadCount = data?.unreadCount ?? 0;

  // 列表内容（桌面 Popover 和移动 Sheet 共用）
  const listContent = (
    <NotificationListContent
      data={data}
      loading={loading}
      busy={busy}
      onItemClick={handleClick}
      onDeleteOne={handleDeleteOne}
      onMarkAllRead={handleMarkAllRead}
      onClearAll={handleClearAll}
    />
  );

  return (
    <>
      {/* 桌面：Popover */}
      <div className="hidden md:block">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="通知"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 sm:w-96">
            {listContent}
          </PopoverContent>
        </Popover>
      </div>

      {/* 移动：Sheet 右滑出 */}
      <div className="md:hidden">
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => setOpen(true)}
          aria-label="通知"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="w-full p-0 sm:max-w-md" showClose={false}>
            <SheetTitle className="sr-only">通知</SheetTitle>
            {listContent}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

/** 列表内容（桌面/移动共用） */
function NotificationListContent({
  data,
  loading,
  busy,
  onItemClick,
  onDeleteOne,
  onMarkAllRead,
  onClearAll,
}: {
  data: ListResponse | null;
  loading: boolean;
  busy: boolean;
  onItemClick: (n: NotificationItem) => void;
  onDeleteOne: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}) {
  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <div className="flex max-h-[80vh] flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">通知</span>
          {unread > 0 && (
            <Badge variant="default" className="h-5 px-1.5 text-[10px]">
              {unread} 未读
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllRead}
            disabled={busy || unread === 0}
            className="h-7 px-2 text-xs"
          >
            <CheckCheck className="size-3.5" />
            全部已读
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            disabled={busy || items.length === 0}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            清空
          </Button>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            加载中...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">暂无通知</p>
              <p className="mt-1 text-xs text-muted-foreground">
                面试临近或投递状态变更时会在此提醒
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onClick={() => onItemClick(n)}
                onDelete={() => onDeleteOne(n.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** 单条通知 */
function NotificationRow({
  n,
  onClick,
  onDelete,
}: {
  n: NotificationItem;
  onClick: () => void;
  onDelete: () => void;
}) {
  const Icon = TYPE_ICON[n.type];
  const badge = TYPE_BADGE[n.type];

  return (
    <li
      className={cn(
        'group relative cursor-pointer px-4 py-3 transition-colors hover:bg-accent/50',
        !n.read && 'bg-primary/5',
      )}
      onClick={onClick}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            n.read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm', n.read ? 'text-foreground' : 'font-semibold text-foreground')}>
              {n.title}
            </span>
            <Badge variant={badge.variant} className="h-4 px-1 text-[10px]">
              {badge.label}
            </Badge>
            {!n.read && <span className="size-2 shrink-0 rounded-full bg-primary" />}
          </div>
          <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground line-clamp-3">
            {n.content}
          </p>
          <p className="text-[11px] text-muted-foreground/70">{formatDateTime(n.createdAt)}</p>
        </div>
        {/* 删除按钮（hover 显示） */}
        <button
          className="absolute right-2 top-2 hidden size-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="删除"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
}
