'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuditAction, AuditLog } from '@prisma/client';
import { Loader2, Inbox, Filter, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils';
import {
  ACTION_LABELS,
  TARGET_TYPE_LABELS,
  TARGET_TYPE_OPTIONS,
} from '@/lib/constants/audit-log';

/** Badge 颜色映射（按动作严重程度） */
const ACTION_BADGE: Record<AuditAction, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  VIEW: 'secondary',
  COPY: 'secondary',
  CREATE: 'default',
  UPDATE: 'default',
  DELETE: 'destructive',
  ROTATE: 'outline',
};

const ACTION_OPTIONS_LIST = Object.entries(ACTION_LABELS).map(([value, label]) => ({
  value: value as AuditAction,
  label,
}));

type AuditLogItem = AuditLog;

interface AuditLogListResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 根据 targetType 从 metadata 提取主标识字段
 * - EnvVault: key
 * - Snapshot: name
 * - Changelog: version
 * - 批量操作（targetId='all'）: 显示「批量」
 */
function extractLabel(log: AuditLogItem): string {
  const meta = (log.metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.key === 'string') return meta.key;
  if (typeof meta.name === 'string') return meta.name;
  if (typeof meta.version === 'string') return meta.version;
  if (log.targetId === 'all') return '（批量）';
  return '-';
}

export function AuditLogList() {
  const [data, setData] = useState<AuditLogListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AuditAction | 'all'>('all');
  const [targetType, setTargetType] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

  const pageSize = 20;

  const buildParams = useCallback(
    (overrides?: { page?: number; pageSize?: number }) => {
      const params = new URLSearchParams({
        page: String(overrides?.page ?? page),
        pageSize: String(overrides?.pageSize ?? pageSize),
      });
      if (action !== 'all') params.set('action', action);
      if (targetType !== 'all') params.set('targetType', targetType);
      return params;
    },
    [page, action, targetType],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit-logs?${buildParams()}`);
      if (!res.ok) throw new Error('加载失败');
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, action, targetType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleActionChange(v: string) {
    setAction(v as AuditAction | 'all');
    setPage(1);
  }

  function handleTargetTypeChange(v: string) {
    setTargetType(v);
    setPage(1);
  }

  /** 导出当前筛选条件下的审计日志为 CSV */
  async function handleExport() {
    setExporting(true);
    try {
      // 导出不分页，只带筛选条件
      const params = new URLSearchParams();
      if (action !== 'all') params.set('action', action);
      if (targetType !== 'all') params.set('targetType', targetType);

      const res = await fetch(`/api/audit-logs/export?${params}`);
      if (!res.ok) throw new Error('导出失败');

      // 从 Content-Disposition 提取文件名
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `audit-logs-${Date.now()}.csv`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // 静默失败，避免 alert 打扰
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 筛选区 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="size-4" />
              <span>筛选</span>
            </div>
            <Select value={action} onValueChange={handleActionChange}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="全部动作" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部动作</SelectItem>
                {ACTION_OPTIONS_LIST.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={targetType} onValueChange={handleTargetTypeChange}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {TARGET_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || !data || data.total === 0}
            title="导出当前筛选条件下的审计日志为 CSV"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            导出 CSV
          </Button>
        </CardContent>
      </Card>

      {/* 日志表格 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              加载中...
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">暂无审计日志</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  在 EnvVault、Snapshot、Changelog 中的操作会在此记录
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">动作</TableHead>
                  <TableHead className="w-[120px]">目标类型</TableHead>
                  <TableHead>键名/版本</TableHead>
                  <TableHead className="w-[180px]">时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((log) => {
                  const targetLabel = TARGET_TYPE_LABELS[log.targetType] ?? log.targetType;
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant={ACTION_BADGE[log.action]}>
                          {ACTION_LABELS[log.action]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{targetLabel}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {extractLabel(log)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            共 {data.total} 条，第 {data.page} / {data.totalPages} 页
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
