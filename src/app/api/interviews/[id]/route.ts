import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { interviewSchema } from '@/lib/validations/interview';

/** 面试详情（include application + questions） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { id } = await params;

  const interview = await prisma.interview.findFirst({
    where: { id, userId: session.user.id },
    include: {
      application: {
        select: { id: true, companyName: true, jobTitle: true },
      },
      questions: true,
    },
  });

  if (!interview) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  return NextResponse.json(interview);
}

/** 更新面试（校验属于当前用户） */
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
  const existing = await prisma.interview.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = interviewSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json({ error: firstError?.message ?? '参数错误' }, { status: 400 });
  }

  const data = parsed.data;
  const interview = await prisma.interview.update({
    where: { id },
    data: {
      round: data.round,
      type: data.type,
      scheduledAt: data.scheduledAt,
      durationMin: data.durationMin ?? null,
      location: data.location || null,
      interviewer: data.interviewer || null,
      status: data.status,
      overallNotes: data.overallNotes || null,
    },
  });

  return NextResponse.json(interview);
}

/** 删除面试（校验属于当前用户） */
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
  const existing = await prisma.interview.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  await prisma.interview.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
