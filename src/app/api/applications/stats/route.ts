import { NextResponse } from 'next/server';
import { Status } from '@prisma/client';

import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';

/**
 * 投递统计：返回各状态计数 + 汇总数据
 * 用于列表页顶部 StatsCards
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 按状态分组计数
  const grouped = await prisma.application.groupBy({
    by: ['status'],
    where: { userId: session.user.id },
    _count: { _all: true },
  });

  // 转成 status -> count 映射
  const counts = grouped.reduce<Record<Status, number>>(
    (acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    },
    {
      PENDING: 0,
      APPLIED: 0,
      WRITTEN: 0,
      INTERVIEW_1: 0,
      INTERVIEW_2: 0,
      INTERVIEW_3: 0,
      HR: 0,
      OFFER: 0,
      REJECTED: 0,
      ABANDONED: 0,
    }
  );

  // 汇总
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const inProgress =
    counts.PENDING +
    counts.APPLIED +
    counts.WRITTEN +
    counts.INTERVIEW_1 +
    counts.INTERVIEW_2 +
    counts.INTERVIEW_3 +
    counts.HR;
  const interviewing =
    counts.INTERVIEW_1 +
    counts.INTERVIEW_2 +
    counts.INTERVIEW_3 +
    counts.HR;
  const offer = counts.OFFER;
  const rejected = counts.REJECTED + counts.ABANDONED;

  return NextResponse.json({
    counts,
    summary: {
      total,
      inProgress,
      interviewing,
      offer,
      rejected,
    },
  });
}
