'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  GitCompare,
  Loader2,
  Inbox,
  Star,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SnapshotFormDialog } from '@/components/features/snapshots/SnapshotFormDialog';
import { formatDateTime } from '@/lib/utils';

export type SnapshotListItem = {
  id: string;
  name: string;
  contentType: string;
  remarks: string | null;
  tags: string[];
  project: string | null;
  isBaseline: boolean;
  baselineId: string | null;
  contentLength: number;
  createdAt: string;
};

const TOAST_DURATION_MS = 2000;

export function SnapshotList() {
  const [items, setItems] = useState<SnapshotListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [project, setProject] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SnapshotListItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set('q', keyword);
      if (project) params.set('project', project);
      const res = await fetch(`/api/snapshots?${params}`);
      if (!res.ok) throw new Error('加载失败');
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [keyword, project]);

  useEffect(() => {
    const timer = setTimeout(() => loadData(), keyword ? 400 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, project]);

  // 监听全局刷新事件
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('snapshots:refresh', handler);
    return () => window.removeEventListener('snapshots:refresh', handler);
  }, [loadData]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      const res = await fetch(`/api/snapshots/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || '删除失败');
        return;
      }
      showToast('已删除');
      // 从选中集合移除
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      loadData();
    } catch {
      showToast('网络错误，请稍后重试');
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }

  const selectedItems = items.filter((i) => selectedIds.has(i.id));
  const canDiff = selectedItems.length === 2;

  return (
    <div className="space-y-6">
      {/* 工具栏 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索名称、备注或标签..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-9"
            />
          </div>
          <Input
            placeholder="项目筛选"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="lg:w-48"
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={loadData} title="刷新" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            </Button>
            <SnapshotFormDialog
              mode="create"
              trigger={
                <Button>
                  <Plus className="size-4" />
                  新建
                </Button>
              }
              onSuccess={() => window.dispatchEvent(new CustomEvent('snapshots:refresh'))}
            />
          </div>
        </CardContent>
      </Card>

      {/* 选中条数 + 对比入口 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            已选 {selectedIds.size} 项
            {selectedIds.size === 2 && '（可选择 2 项进行对比）'}
            {selectedIds.size > 2 && '（最多选择 2 项对比，请取消多余选择）'}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              清除选择
            </Button>
            <Button size="sm" disabled={!canDiff} asChild>
              {canDiff ? (
                <Link href={`/tools/snapshots/diff?a=${selectedItems[0].id}&b=${selectedItems[1].id}`}>
                  <GitCompare className="size-4" />
                  对比选中
                </Link>
              ) : (
                <span>
                  <GitCompare className="size-4" />
                  对比选中
                </span>
              )}
            </Button>
          </div>
        </div>
      )}

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
                <Inbox className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {keyword || project ? '没有匹配的快照' : '还没有快照'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {keyword || project ? '试试调整搜索关键词' : '新建一个快照开始记录版本变化'}
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={selectedIds.size === items.length && items.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead className="hidden md:table-cell">类型</TableHead>
                  <TableHead className="hidden md:table-cell">项目</TableHead>
                  <TableHead className="hidden lg:table-cell">标签</TableHead>
                  <TableHead className="hidden sm:table-cell">大小</TableHead>
                  <TableHead className="hidden xl:table-cell">创建时间</TableHead>
                  <TableHead className="pr-6 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-6">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.isBaseline && (
                          <Star className="size-4 fill-amber-400 text-amber-400" />
                        )}
                        <Link
                          href={`/tools/snapshots/${item.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {item.name}
                        </Link>
                      </div>
                      {item.remarks && (
                        <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                          {item.remarks}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="font-mono text-xs">
                        {item.contentType.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {item.project || '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {item.tags.length === 0 ? (
                          <span className="text-xs text-muted-foreground">-</span>
                        ) : (
                          item.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">
                              {t}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {item.contentLength.toLocaleString()} 字符
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <SnapshotFormDialog
                          mode="edit"
                          snapshot={item}
                          trigger={
                            <Button variant="ghost" size="icon" className="size-8" title="编辑">
                              <Pencil className="size-4" />
                            </Button>
                          }
                          onSuccess={() => window.dispatchEvent(new CustomEvent('snapshots:refresh'))}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          title="删除"
                          onClick={() => setDeleteTarget(item)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
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

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              将删除快照「{deleteTarget?.name}」，此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={!!deletingId}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!!deletingId}>
              {deletingId && <Loader2 className="size-4 animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
