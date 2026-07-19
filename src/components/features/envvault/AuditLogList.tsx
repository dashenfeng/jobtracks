'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuditAction, AuditLog } from '@prisma/client';
import { Loader2, Inbox, Filter } from 'lucide-react';

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

/** 审计动作中文映射 + Badge 颜色 */
const ACTION_MAP: Record<
  AuditAction,
  { label: string; badge: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  VIEW: { label: '查看', badge: 'secondary' },
  COPY: { label: '复制', badge: 'secondary' },
  CREATE: { label: '创建', badge: 'default' },
  UPDATE: { label: '更新', badge: 'default' },
  DELETE: { label: '删除', badge: 'destructive' },
  ROTATE: { label: '轮换', badge: 'outline' },
};

const ACTION_OPTIONS: { value: AuditAction; label: string }[] = [
  { value: 'VIEW', label: '查看' },
  { value: 'COPY', label: '复制' },
  { value: 'CREATE', label: '创建' },
  { value: 'UPDATE', label: '更新' },
  { value: 'DELETE', label: '删除' },
  { value: 'ROTATE', label: '轮换' },
];

/** targetType 中文映射 */
const TARGET_TYPE_MAP: Record<string, string> = {
  EnvVault: '环境变量',
  Application: '投递记录',
  Interview: '面试记录',
  InterviewQuestion: '面经题目',
};

type AuditLogItem = AuditLog;

interface AuditLogListResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function AuditLogList() {
  const [data, setData] = useState<AuditLogListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AuditAction | 'all'>('all');

  const pageSize = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (action !== 'all') params.set('action', action);
      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) throw new Error('加载失败');
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, action]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleActionChange(v: string) {
    setAction(v as AuditAction | 'all');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* 筛选区 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="size-4" />
            <span>按动作筛选</span>
          </div>
          <Select value={action} onValueChange={handleActionChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="全部动作" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部动作</SelectItem>
              {ACTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  在 EnvVault 中查看或复制环境变量后会在此记录
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">动作</TableHead>
                  <TableHead className="w-[120px]">目标类型</TableHead>
                  <TableHead>键名</TableHead>
                  <TableHead className="w-[180px]">时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((log) => {
                  const actionConfig = ACTION_MAP[log.action];
                  const targetLabel = TARGET_TYPE_MAP[log.targetType] ?? log.targetType;
                  // metadata 结构：{ key?: string }
                  const meta = (log.metadata ?? {}) as { key?: string };
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant={actionConfig.badge}>{actionConfig.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{targetLabel}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {meta.key ?? '-'}
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
