'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Pencil,
  Download,
  Upload,
  Loader2,
  Inbox,
  Clock,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EnvVaultFormDialog } from '@/components/features/envvault/EnvVaultFormDialog';
import { EnvVaultImportDialog } from '@/components/features/envvault/EnvVaultImportDialog';
import { useSensitiveAuth } from '@/components/features/envvault/useSensitiveAuth';
import { formatDateTime } from '@/lib/utils';

export type EnvVaultListItem = {
  id: string;
  key: string;
  value: string; // 掩码或 '••••••••'
  tags: string[];
  notes: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  lastCopiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const REVEAL_AUTO_RESTORE_MS = 5000;
const TOAST_DURATION_MS = 2000;

export function EnvVaultList() {
  const [items, setItems] = useState<EnvVaultListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // 删除确认弹窗
  const [deleteTarget, setDeleteTarget] = useState<EnvVaultListItem | null>(null);
  // 轮换确认弹窗 + 结果
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotateResult, setRotateResult] = useState<{ rotated: number; failed: number; total: number } | null>(null);

  // 二次认证
  const sensitiveAuth = useSensitiveAuth();

  // 当前显示明文的 id 及自动恢复掩码的定时器
  const [revealedMap, setRevealedMap] = useState<
    Record<string, { value: string; timer: ReturnType<typeof setTimeout> }>
  >({});

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set('q', keyword);
      const res = await fetch(`/api/envvault?${params}`);
      if (!res.ok) throw new Error('加载失败');
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  // 初始加载 + 搜索防抖（合并为单个 useEffect，避免双重加载）
  useEffect(() => {
    const timer = setTimeout(() => loadData(), keyword ? 400 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  // 卸载时清理所有定时器
  useEffect(() => {
    return () => {
      Object.values(revealedMap).forEach((entry) => clearTimeout(entry.timer));
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearReveal(id: string) {
    setRevealedMap((prev) => {
      const next = { ...prev };
      if (next[id]) {
        clearTimeout(next[id].timer);
        delete next[id];
      }
      return next;
    });
  }

  async function handleReveal(item: EnvVaultListItem) {
    // 已显示明文 → 点击恢复掩码
    if (revealedMap[item.id]) {
      clearReveal(item.id);
      return;
    }

    // 二次认证
    const token = await sensitiveAuth.ensureVerified();
    if (!token) return; // 用户取消

    setRevealingId(item.id);
    try {
      const res = await fetch(`/api/envvault/${item.id}/reveal`, {
        method: 'POST',
        headers: { 'X-Verify-Token': token },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 && data.code === 'VERIFY_REQUIRED') {
          sensitiveAuth.clearToken();
          showToast('验证已过期，请重试');
        } else {
          showToast(data.error || '查看失败');
        }
        return;
      }
      const timer = setTimeout(() => clearReveal(item.id), REVEAL_AUTO_RESTORE_MS);
      setRevealedMap((prev) => {
        if (prev[item.id]) clearTimeout(prev[item.id].timer);
        return { ...prev, [item.id]: { value: data.value, timer } };
      });
      loadData();
    } catch {
      showToast('网络错误，请稍后重试');
    } finally {
      setRevealingId(null);
    }
  }

  async function handleCopy(item: EnvVaultListItem) {
    // 二次认证
    const token = await sensitiveAuth.ensureVerified();
    if (!token) return;

    setCopyingId(item.id);
    try {
      const res = await fetch(`/api/envvault/${item.id}/copy`, {
        method: 'POST',
        headers: { 'X-Verify-Token': token },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 && data.code === 'VERIFY_REQUIRED') {
          sensitiveAuth.clearToken();
          showToast('验证已过期，请重试');
        } else {
          showToast(data.error || '复制失败');
        }
        return;
      }
      await navigator.clipboard.writeText(data.value);
      showToast('已复制');
      loadData();
    } catch {
      showToast('复制失败，请稍后重试');
    } finally {
      setCopyingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      const res = await fetch(`/api/envvault/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || '删除失败');
        return;
      }
      clearReveal(deleteTarget.id);
      showToast('已删除');
      loadData();
    } catch {
      showToast('网络错误，请稍后重试');
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }

  async function handleExport() {
    // 二次认证
    const token = await sensitiveAuth.ensureVerified();
    if (!token) return;

    setExporting(true);
    try {
      const res = await fetch('/api/envvault/export', {
        method: 'POST',
        headers: { 'X-Verify-Token': token },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 && data.code === 'VERIFY_REQUIRED') {
          sensitiveAuth.clearToken();
          showToast('验证已过期，请重试');
        } else {
          showToast(data.error || '导出失败');
        }
        return;
      }
      // 触发浏览器下载
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // 从 Content-Disposition 提取文件名
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] ?? 'env-export.env';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('已导出');
    } catch {
      showToast('导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  }

  async function handleRotate() {
    // 二次认证
    const token = await sensitiveAuth.ensureVerified();
    if (!token) return;

    setRotating(true);
    try {
      const res = await fetch('/api/envvault/rotate', {
        method: 'POST',
        headers: { 'X-Verify-Token': token },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 && data.code === 'VERIFY_REQUIRED') {
          sensitiveAuth.clearToken();
          showToast('验证已过期，请重试');
        } else {
          showToast(data.error || '轮换失败');
        }
        return;
      }
      setRotateResult(data);
      showToast(`已轮换 ${data.rotated} 条`);
    } catch {
      showToast('网络错误，请稍后重试');
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 工具栏 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索键名或标签..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <EnvVaultFormDialog
              mode="create"
              trigger={
                <Button>
                  <Plus className="size-4" />
                  新增
                </Button>
              }
              onSuccess={loadData}
            />
            <EnvVaultImportDialog
              trigger={
                <Button variant="outline">
                  <Upload className="size-4" />
                  导入
                </Button>
              }
              onSuccess={loadData}
            />
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              导出
            </Button>
            <Button variant="outline" onClick={() => { setRotateResult(null); setRotateOpen(true); }}>
              <RefreshCw className="size-4" />
              轮换
            </Button>
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
                <Inbox className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {keyword ? '没有匹配的记录' : '还没有环境变量'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {keyword ? '试试调整搜索关键词' : '开始加密存储你的敏感配置'}
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">键名</TableHead>
                  <TableHead>值</TableHead>
                  <TableHead className="hidden md:table-cell">标签</TableHead>
                  <TableHead className="hidden lg:table-cell">备注</TableHead>
                  <TableHead className="hidden md:table-cell">查看次数</TableHead>
                  <TableHead className="hidden xl:table-cell">最后查看</TableHead>
                  <TableHead className="hidden xl:table-cell">最后复制</TableHead>
                  <TableHead className="pr-6 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const revealed = revealedMap[item.id];
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="pl-6">
                        <span className="font-mono text-sm font-medium text-foreground">
                          {item.key}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="max-w-[180px] truncate font-mono text-sm text-muted-foreground"
                            title={revealed ? revealed.value : undefined}
                          >
                            {revealed ? revealed.value : item.value}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title={revealed ? '隐藏' : '查看明文'}
                            onClick={() => handleReveal(item)}
                            disabled={revealingId === item.id}
                          >
                            {revealingId === item.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : revealed ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {item.tags.length === 0 ? (
                          <span className="text-sm text-muted-foreground">-</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {item.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="font-normal">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden max-w-[200px] lg:table-cell">
                        <span
                          className="block truncate text-sm text-muted-foreground"
                          title={item.notes ?? undefined}
                        >
                          {item.notes || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">{item.viewCount}</span>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          {item.lastViewedAt ? (
                            <>
                              <Clock className="size-3.5" />
                              {formatDateTime(item.lastViewedAt)}
                            </>
                          ) : (
                            '-'
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          {item.lastCopiedAt ? (
                            <>
                              <Clock className="size-3.5" />
                              {formatDateTime(item.lastCopiedAt)}
                            </>
                          ) : (
                            '-'
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="复制明文"
                            onClick={() => handleCopy(item)}
                            disabled={copyingId === item.id}
                          >
                            {copyingId === item.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </Button>
                          <EnvVaultFormDialog
                            mode="edit"
                            envVault={item}
                            trigger={
                              <Button variant="ghost" size="icon" title="编辑">
                                <Pencil className="size-4" />
                              </Button>
                            }
                            onSuccess={loadData}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            title="删除"
                            onClick={() => setDeleteTarget(item)}
                            disabled={deletingId === item.id}
                            className="text-muted-foreground hover:text-destructive"
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定删除「{deleteTarget?.key}」吗？此操作不可撤销，解密密钥不会恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={!!deletingId}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!!deletingId}>
              {!!deletingId && <Loader2 className="size-4 animate-spin" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 轮换确认弹窗 */}
      <Dialog open={rotateOpen} onOpenChange={(o) => !o && setRotateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="size-4" />
              密钥轮换
            </DialogTitle>
            <DialogDescription>
              {rotateResult
                ? `已完成：成功 ${rotateResult.rotated} 条，失败 ${rotateResult.failed} 条，共 ${rotateResult.total} 条`
                : '将重新加密你的所有环境变量（生成新 IV），让旧密文失效。适用于怀疑密文泄露的场景。此操作不可撤销。'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRotateOpen(false)}
              disabled={rotating}
            >
              {rotateResult ? '关闭' : '取消'}
            </Button>
            {!rotateResult && (
              <Button onClick={handleRotate} disabled={rotating}>
                {rotating && <Loader2 className="size-4 animate-spin" />}
                确认轮换
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 二次认证弹窗 */}
      {sensitiveAuth.dialog}

      {/* 轻量 toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
