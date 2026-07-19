import { NextResponse } from 'next/server';

import {
  QuestionDifficulty,
  QuestionPerformance,
} from '@prisma/client';

import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';

/** 获取当前用户的"待复盘"题目（默认 performance 为 POOR 或 OKAY） */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const performanceParam = searchParams.get('performance') ?? 'POOR_OKAY';
  const difficulty = searchParams.get('difficulty');

  // 解析 performance 筛选
  let performanceFilter: QuestionPerformance[] | undefined;
  if (performanceParam !== 'ALL') {
    const map: Record<string, QuestionPerformance[]> = {
      POOR: [QuestionPerformance.POOR],
      OKAY: [QuestionPerformance.OKAY],
      GOOD: [QuestionPerformance.GOOD],
      POOR_OKAY: [QuestionPerformance.POOR, QuestionPerformance.OKAY],
    };
    performanceFilter = map[performanceParam];
    if (!performanceFilter) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }
  }

  // 解析 difficulty 筛选
  let difficultyFilter: QuestionDifficulty | undefined;
  if (difficulty && difficulty !== 'ALL') {
    if (
      !Object.values(QuestionDifficulty).includes(difficulty as QuestionDifficulty)
    ) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }
    difficultyFilter = difficulty as QuestionDifficulty;
  }

  const items = await prisma.interviewQuestion.findMany({
    where: {
      userId: session.user.id,
      ...(performanceFilter ? { performance: { in: performanceFilter } } : {}),
      ...(difficultyFilter ? { difficulty: difficultyFilter } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      interview: {
        select: {
          id: true,
          round: true,
          scheduledAt: true,
          application: {
            select: { id: true, companyName: true, jobTitle: true },
          },
        },
      },
    },
  });

  return NextResponse.json(items);
}
