import { NextResponse } from 'next/server';

import { InterviewStatus } from '@prisma/client';

import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';

/** 获取当前用户的所有面试列表（支持 status 筛选 + 时间范围 from/to） */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? undefined;
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;

  // status 必须是合法枚举值
  if (
    status &&
    !Object.values(InterviewStatus).includes(status as InterviewStatus)
  ) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const where = {
    userId: session.user.id,
    ...(status ? { status: status as InterviewStatus } : {}),
    ...(from || to
      ? {
          scheduledAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const items = await prisma.interview.findMany({
    where,
    orderBy: { scheduledAt: 'desc' },
    include: {
      application: {
        select: { companyName: true, jobTitle: true },
      },
    },
  });

  return NextResponse.json(items);
}
