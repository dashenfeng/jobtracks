'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Application, Channel, Status } from '@prisma/client';
import { Plus, Search, ExternalLink, Pencil, Inbox, Eye, EyeOff, Trash2, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { StatusSwitcher } from '@/components/features/applications/StatusSwitcher';
import { StatsCards } from '@/components/features/applications/StatsCards';
import { SalaryCell } from '@/components/features/applications/SalaryCell';
import { ApplicationFormDialog } from '@/components/features/applications/ApplicationFormDialog';
import { CHANNEL_MAP, CHANNEL_OPTIONS, STATUS_OPTIONS } from '@/lib/constants/applications';
import { formatDate } from '@/lib/utils';

interface ListResponse {
  items: Application[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ApplicationListProps {
  /** 薪资默认是否掩码（来自用户偏好 settings） */
  salaryMaskByDefault: boolean;
}

export function ApplicationList({ salaryMaskByDefault }: ApplicationListProps) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 筛选状态
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [channel, setChannel] = useState<Channel | 'all'>('all');
  const [page, setPage] = useState(1);

  // 薪资显示：初始值取自用户偏好（掩码模式 = 不可见）
  const [salaryVisible, setSalaryVisible] = useState(!salaryMaskByDefault);

  // 状态切换后刷新统计卡片
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const refreshStats = useCallback(() => setStatsRefreshKey((k) => k + 1), []);

  // 删除中标记：避免重复点击
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pageSize = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (keyword) params.set('keyword', keyword);
      if (status !== 'all') params.set('status', status);
      if (channel !== 'all') params.set('channel', channel);

      const res = await fetch(`/api/applications?${params}`);
      if (!res.ok) throw new Error('加载失败');
      setData(await res.json());
    } catch {
      setError('加载失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  }, [page, keyword, status, channel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 监听全局刷新事件（顶部"新增投递"按钮成功后派发）
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('applications:refresh', handler);
    return () => window.removeEventListener('applications:refresh', handler);
  }, [loadData]);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1);
      else loadData();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  function handleStatusChange(v: string) {
    setStatus(v as Status | 'all');
    setPage(1);
  }

  function handleChannelChange(v: string) {
    setChannel(v as Channel | 'all');
    setPage(1);
  }

  // 删除投递：二次确认后调用 DELETE API
  async function handleDelete(item: Application) {
    const confirmMsg = `确定删除「${item.companyName} · ${item.jobTitle}」吗？\n\n该投递关联的所有面试记录和面经题目也会一并删除，此操作不可撤销。`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/applications/${item.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || '删除失败');
      }
      loadData();
      refreshStats();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <StatsCards refreshKey={statsRefreshKey} />

      {/* 筛选区 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索公司名或职位..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={channel} onValueChange={handleChannelChange}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="渠道" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部渠道</SelectItem>
              {CHANNEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={loadData}
            disabled={loading}
            title="刷新"
            className="flex-shrink-0"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </CardContent>
      </Card>

      {/* 表格 */}
      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-10 text-center text-sm text-destructive">{error}</div>
          ) : loading && !data ? (
            <div className="p-10 text-center text-sm text-muted-foreground">加载中...</div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {keyword || status !== 'all' || channel !== 'all'
                    ? '没有匹配的记录'
                    : '还没有投递记录'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {keyword || status !== 'all' || channel !== 'all'
                    ? '试试调整筛选条件'
                    : '开始记录你的求职进度吧'}
                </p>
              </div>
              {!(keyword || status !== 'all' || channel !== 'all') && (
                <ApplicationFormDialog
                  mode="create"
                  trigger={
                    <Button>
                      <Plus className="size-4" />
                      新增投递
                    </Button>
                  }
                  onSuccess={loadData}
                />
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">公司 / 职位</TableHead>
                  <TableHead className="hidden md:table-cell">渠道</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="hidden lg:table-cell">城市</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <button
                      type="button"
                      onClick={() => setSalaryVisible((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      title={salaryVisible ? '点击掩码' : '点击显示明文'}
                    >
                      薪资
                      {salaryVisible ? (
                        <Eye className="size-3.5" />
                      ) : (
                        <EyeOff className="size-3.5" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">更新时间</TableHead>
                  <TableHead className="pr-6 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">{item.companyName}</span>
                        <span className="text-sm text-muted-foreground">{item.jobTitle}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {CHANNEL_MAP[item.channel]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusSwitcher
                        id={item.id}
                        status={item.status}
                        onSuccess={() => {
                          loadData();
                          refreshStats();
                        }}
                      />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">{item.city || '-'}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <SalaryCell value={item.salaryRange} visible={salaryVisible} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {formatDate(item.updatedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild title="查看详情">
                          <Link href={`/applications/${item.id}`}>
                            <ExternalLink className="size-4" />
                          </Link>
                        </Button>
                        <ApplicationFormDialog
                          mode="edit"
                          application={item}
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
                          onClick={() => handleDelete(item)}
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
                ))}
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
