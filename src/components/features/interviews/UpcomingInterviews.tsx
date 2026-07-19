'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Interview, InterviewStatus, Application } from '@prisma/client';
import { AlarmClock, CalendarClock, Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { INTERVIEW_TYPE_MAP } from '@/lib/constants/interviews';
import { formatCountdown } from '@/lib/utils';

type ScheduleItem = Interview & {
  application: Pick<Application, 'id' | 'companyName' | 'jobTitle'>;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function UpcomingInterviews() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/interviews?status=SCHEDULED');
      if (!res.ok) throw new Error('加载失败');
      const all: ScheduleItem[] = await res.json();
      const now = Date.now();
      // 仅显示 7 天内（含已过期未更新的）
      const filtered = all
        .filter((it) => {
          const t = new Date(it.scheduledAt).getTime();
          return t <= now + SEVEN_DAYS_MS;
        })
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        );
      setItems(filtered);
    } catch {
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 加载中：不渲染（避免闪烁）
  if (loading) return null;
  if (error) return null;
  if (items.length === 0) return null;

  const now = Date.now();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <CalendarClock className="size-5 text-primary" />
          即将到来
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const t = new Date(item.scheduledAt).getTime();
          const isOverdue = t < now;
          const typeConfig = INTERVIEW_TYPE_MAP[item.type];
          return (
            <Link
              key={item.id}
              href={`/interviews/${item.id}`}
              className="block rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {item.application.companyName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · 第 {item.round} 轮 · {typeConfig.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.application.jobTitle
                      ? `${item.application.jobTitle} · `
                      : ''}
                    {formatCountdown(item.scheduledAt)}
                  </p>
                </div>
                <Badge
                  variant={isOverdue ? 'destructive' : 'default'}
                  className="flex items-center gap-1"
                >
                  <AlarmClock className="size-3" />
                  {isOverdue ? '待更新状态' : '待面试'}
                </Badge>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
