'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Interview, InterviewStatus, Application } from '@prisma/client';
import { Inbox, Loader2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INTERVIEW_TYPE_MAP, INTERVIEW_STATUS_MAP } from '@/lib/constants/interviews';
import { formatDateTime } from '@/lib/utils';

type ScheduleItem = Interview & {
  application: Pick<Application, 'companyName' | 'jobTitle'>;
};

const STATUS_FILTER_OPTIONS: { value: InterviewStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'SCHEDULED', label: '待面试' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
];

export function InterviewSchedule() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<InterviewStatus | 'all'>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      const res = await fetch(`/api/interviews?${params}`);
      if (!res.ok) throw new Error('加载失败');
      setItems(await res.json());
    } catch {
      setError('加载失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-4">
      {/* 筛选区 */}
      <div className="flex items-center gap-3">
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as InterviewStatus | 'all')}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 列表 */}
      {error ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            加载中...
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {status !== 'all' ? '没有匹配的面试' : '还没有面试安排'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {status !== 'all' ? '试试调整筛选条件' : '在投递详情中添加面试场次吧'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const statusConfig = INTERVIEW_STATUS_MAP[item.status];
            const typeConfig = INTERVIEW_TYPE_MAP[item.type];
            return (
              <Link key={item.id} href={`/interviews/${item.id}`} className="block">
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {item.application.companyName}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          · 第 {item.round} 轮 · {typeConfig.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(item.scheduledAt)}
                        {item.application.jobTitle ? ` · ${item.application.jobTitle}` : ''}
                      </p>
                    </div>
                    <Badge variant={statusConfig.badge}>{statusConfig.label}</Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
