'use client';

import { useEffect, useState } from 'react';
import { Briefcase, Clock, Users, Trophy } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsSummary {
  total: number;
  inProgress: number;
  interviewing: number;
  offer: number;
  rejected: number;
}

interface StatsCardsProps {
  /** 改变此值会触发重新加载（用于状态切换后刷新统计） */
  refreshKey?: number;
}

const CARDS = [
  { key: 'total' as const, label: '总投递', icon: Briefcase, accent: 'text-foreground' },
  { key: 'inProgress' as const, label: '进行中', icon: Clock, accent: 'text-blue-500' },
  { key: 'interviewing' as const, label: '面试中', icon: Users, accent: 'text-violet-500' },
  { key: 'offer' as const, label: 'Offer', icon: Trophy, accent: 'text-emerald-500' },
];

/**
 * 投递统计卡片（4 个）：总投递 / 进行中 / 面试中 / Offer
 * 数据来自 /api/applications/stats
 */
export function StatsCards({ refreshKey = 0 }: StatsCardsProps) {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/applications/stats')
      .then((r) => r.json())
      .then((data) => {
        if (active && data?.summary) setStats(data.summary);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {CARDS.map((card) => {
        const value = stats ? stats[card.key] : null;
        const Icon = card.icon;
        return (
          <Card key={card.key}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <Icon className={cn('size-4', card.accent)} />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {loading ? '-' : value ?? 0}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
