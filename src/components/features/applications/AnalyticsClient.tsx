'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList,
} from 'recharts';
import { Briefcase, Clock, Users, Trophy, Inbox } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Metrics {
  total: number;
  interviewCount: number;
  offerCount: number;
  activeCount: number;
  interviewRate: number;
  offerRate: number;
}

interface AnalyticsData {
  metrics: Metrics;
  trend: Array<{ month: string; count: number }>;
  statusDistribution: Array<{ name: string; value: number; key: string }>;
  channelDistribution: Array<{ name: string; count: number; key: string }>;
  funnel: Array<{ stage: string; count: number }>;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'hsl(var(--popover-foreground))',
};

const METRIC_CARDS = [
  { key: 'total', label: '总投递', icon: Briefcase, accent: 'text-chart-1', getValue: (m: Metrics) => m.total },
  { key: 'activeCount', label: '进行中', icon: Clock, accent: 'text-chart-2', getValue: (m: Metrics) => m.activeCount },
  { key: 'interviewRate', label: '面试率', icon: Users, accent: 'text-chart-3', getValue: (m: Metrics) => `${(m.interviewRate * 100).toFixed(0)}%` },
  { key: 'offerRate', label: 'Offer率', icon: Trophy, accent: 'text-chart-4', getValue: (m: Metrics) => `${(m.offerRate * 100).toFixed(0)}%` },
] as const;

export function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/applications/analytics')
      .then(async (r) => {
        if (!r.ok) throw new Error('加载失败');
        return r.json();
      })
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError('加载失败，请刷新重试');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          加载中...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!data || data.metrics.total === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 p-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">暂无投递数据</p>
            <p className="mt-1 text-sm text-muted-foreground">
              开始投递后即可查看数据分析
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { metrics, trend, statusDistribution, channelDistribution, funnel } = data;

  return (
    <div className="space-y-6">
      {/* 指标卡 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {METRIC_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <Icon className={cn('size-4', card.accent)} />
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {card.getValue(metrics)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 投递趋势 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">投递趋势（近 6 个月）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: string) => `${v.split('-')[1]}月`}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(v) => String(v)}
                  formatter={(v) => [v, '投递数']}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(var(--chart-1))' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 状态分布 + 渠道分布 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {statusDistribution.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v, n) => [v, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
              {statusDistribution.map((item, i) => (
                <div key={item.key} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">渠道分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelDistribution} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    stroke="hsl(var(--border))"
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                    formatter={(v) => [v, '投递数']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {channelDistribution.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 转化漏斗 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">转化漏斗</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnel}
                layout="vertical"
                margin={{ top: 8, right: 32, left: 16, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  type="category"
                  dataKey="stage"
                  tick={{ fontSize: 13, fill: 'hsl(var(--foreground))' }}
                  stroke="hsl(var(--border))"
                  width={56}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                  formatter={(v) => [v, '数量']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {funnel.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                  <LabelList dataKey="count" position="right" style={{ fontSize: 12, fill: 'hsl(var(--foreground))', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            漏斗按累计统计：每层包含其后所有阶段，已结束的拒绝/放弃不计入
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
