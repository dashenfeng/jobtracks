import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { questionSchema } from '@/lib/validations/interview';

/** 获取某面试的所有题目（按 createdAt 正序） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { id } = await params;

  // 校验面试属于当前用户
  const interview = await prisma.interview.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!interview) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  const questions = await prisma.interviewQuestion.findMany({
    where: { interviewId: id },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(questions);
}

/** 新增题目（校验 interview 属于当前用户 + 写入 userId） */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { id } = await params;

  // 校验面试属于当前用户
  const interview = await prisma.interview.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!interview) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json({ error: firstError?.message ?? '参数错误' }, { status: 400 });
  }

  const data = parsed.data;
  const question = await prisma.interviewQuestion.create({
    data: {
      question: data.question,
      myAnswer: data.myAnswer || null,
      referenceAnswer: data.referenceAnswer || null,
      tags: data.tags ?? [],
      difficulty: data.difficulty,
      performance: data.performance,
      interviewId: id,
      userId: session.user.id,
    },
  });

  return NextResponse.json(question);
}
