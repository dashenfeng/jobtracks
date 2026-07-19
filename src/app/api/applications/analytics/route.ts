import { NextResponse } from 'next/server';
import { Channel, Status } from '@prisma/client';

import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';
import { STATUS_MAP, CHANNEL_MAP } from '@/lib/constants/applications';

/**
 * 数据分析：聚合投递数据，返回趋势/分布/漏斗/指标
 * 求职数据量小，一次 findMany + JS 聚合，避免多次 groupBy
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const apps = await prisma.application.findMany({
    where: { userId: session.user.id },
    select: { status: true, channel: true, createdAt: true },
  });

  const total = apps.length;

  // 状态分布
  const statusCounts = new Map<Status, number>();
  for (const a of apps) {
    statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
  }
  const statusDistribution = (Object.keys(STATUS_MAP) as Status[])
    .map((key) => ({
      name: STATUS_MAP[key].label,
      value: statusCounts.get(key) ?? 0,
      key,
    }))
    .filter((item) => item.value > 0);

  // 渠道分布
  const channelCounts = new Map<Channel, number>();
  for (const a of apps) {
    channelCounts.set(a.channel, (channelCounts.get(a.channel) ?? 0) + 1);
  }
  const channelDistribution = (Object.keys(CHANNEL_MAP) as Channel[])
    .map((key) => ({
      name: CHANNEL_MAP[key],
      count: channelCounts.get(key) ?? 0,
      key,
    }))
    .filter((item) => item.count > 0);

  // 月度趋势（最近 6 个月）
  const now = new Date();
  const months: Array<{ month: string; count: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ month: key, count: 0 });
  }
  const monthMap = new Map(months.map((m) => [m.month, m]));
  for (const a of apps) {
    const d = a.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const m = monthMap.get(key);
    if (m) m.count++;
  }

  // 转化漏斗（累计，每层是上层子集，排除已结束的 REJECTED/ABANDONED）
  const inSet = (s: Status, set: Status[]) => set.includes(s);
  const APPLIED_OR_FURTHER: Status[] = [
    'APPLIED', 'WRITTEN', 'INTERVIEW_1', 'INTERVIEW_2', 'INTERVIEW_3', 'HR', 'OFFER',
  ];
  const WRITTEN_OR_FURTHER: Status[] = [
    'WRITTEN', 'INTERVIEW_1', 'INTERVIEW_2', 'INTERVIEW_3', 'HR', 'OFFER',
  ];
  const INTERVIEW_OR_FURTHER: Status[] = [
    'INTERVIEW_1', 'INTERVIEW_2', 'INTERVIEW_3', 'HR', 'OFFER',
  ];
  const funnel = [
    { stage: '已投递', count: apps.filter((a) => inSet(a.status, APPLIED_OR_FURTHER)).length },
    { stage: '笔试', count: apps.filter((a) => inSet(a.status, WRITTEN_OR_FURTHER)).length },
    { stage: '面试', count: apps.filter((a) => inSet(a.status, INTERVIEW_OR_FURTHER)).length },
    { stage: 'Offer', count: apps.filter((a) => a.status === 'OFFER').length },
  ];

  // 关键指标
  const interviewCount = apps.filter((a) =>
    inSet(a.status, INTERVIEW_OR_FURTHER)
  ).length;
  const offerCount = statusCounts.get('OFFER') ?? 0;
  const activeCount = apps.filter((a) =>
    inSet(a.status, ['PENDING', 'APPLIED', 'WRITTEN', 'INTERVIEW_1', 'INTERVIEW_2', 'INTERVIEW_3', 'HR'])
  ).length;

  return NextResponse.json({
    metrics: {
      total,
      interviewCount,
      offerCount,
      activeCount,
      interviewRate: total > 0 ? interviewCount / total : 0,
      offerRate: total > 0 ? offerCount / total : 0,
    },
    trend: months,
    statusDistribution,
    channelDistribution,
    funnel,
  });
}
