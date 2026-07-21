'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Trash2,
  Loader2,
  Inbox,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChangelogFormDialog } from '@/components/features/changelog/ChangelogFormDialog';
import { CHANGE_TYPE_MAP } from '@/lib/constants/changelog';
import { CHANGE_TYPES, type ChangeType } from '@/lib/validations/changelog';
import { formatDate } from '@/lib/utils';

export type ChangelogListItem = {
  id: string;
  version: string;
  releasedAt: string;
  screenshots: string[];
  createdAt: string;
  updatedAt: string;
  _count: { changes: number };
};

const TOAST_DURATION_MS = 2000;

export function ChangelogList() {
  const [items, setItems] = useState<ChangelogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<ChangeType | 'ALL'>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<ChangelogListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set('q', keyword);
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      const res = await fetch(`/api/changelogs?${params}`);
      if (!res.ok) throw new Error('加载失败');
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [keyword, typeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => loadData(), keyword ? 400 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, typeFilter]);

  // 监听全局刷新事件
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('changelogs:refresh', handler);
    return () => window.removeEventListener('changelogs:refresh', handler);
  }, [loadData]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/changelogs/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || '删除失败');
        return;
      }
      showToast('已删除');
      setDeleteTarget(null);
      loadData();
    } catch {
      showToast('网络错误');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="搜索版本号或变更描述"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as ChangeType | 'ALL')}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部类型</SelectItem>
                {CHANGE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CHANGE_TYPE_MAP[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => loadData()}
              disabled={loading}
              title="刷新"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>
            <ChangelogFormDialog
              mode="create"
              onSuccess={() => {
                showToast('已创建');
                loadData();
              }}
              trigger={
                <Button size="sm">
                  <Plus size={14} />
                  新建
                </Button>
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 列表 */}
      <Card>
        <CardContent className="p-0">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              加载中...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="size-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">暂无 Changelog</p>
                <p className="text-xs text-muted-foreground">
                  点击右上角「新建」开始记录你的版本变更
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">版本号</TableHead>
                  <TableHead className="hidden md:table-cell">变更数</TableHead>
                  <TableHead className="hidden sm:table-cell">截图</TableHead>
                  <TableHead className="hidden lg:table-cell">发布日期</TableHead>
                  <TableHead className="pr-6 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-6 font-medium">
                      <Link
                        href={`/tools/changelog/${item.id}`}
                        className="text-foreground underline-offset-4 hover:underline"
                      >
                        {item.version}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary">{item._count.changes}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {item.screenshots.length > 0
                        ? `${item.screenshots.length} 张`
                        : '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground tabular-nums">
                      {formatDate(item.releasedAt)}
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="删除"
                          onClick={() => setDeleteTarget(item)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 删除确认 */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除 Changelog</DialogTitle>
            <DialogDescription>
              确定删除版本 <span className="font-medium text-foreground">{deleteTarget?.version}</span> 吗？该操作不可撤销，关联的所有变更项也会一并删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
