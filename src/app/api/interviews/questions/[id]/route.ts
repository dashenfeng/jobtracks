import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { questionSchema } from '@/lib/validations/interview';

/** 更新题目（校验属于当前用户） */
export async function PATCH(
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

  // 确认记录存在且属于当前用户
  const existing = await prisma.interviewQuestion.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json({ error: firstError?.message ?? '参数错误' }, { status: 400 });
  }

  const data = parsed.data;
  const question = await prisma.interviewQuestion.update({
    where: { id },
    data: {
      question: data.question,
      myAnswer: data.myAnswer || null,
      referenceAnswer: data.referenceAnswer || null,
      tags: data.tags ?? [],
      difficulty: data.difficulty,
      performance: data.performance,
    },
  });

  return NextResponse.json(question);
}

/** 删除题目（校验属于当前用户） */
export async function DELETE(
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

  // 确认记录存在且属于当前用户
  const existing = await prisma.interviewQuestion.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  await prisma.interviewQuestion.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
