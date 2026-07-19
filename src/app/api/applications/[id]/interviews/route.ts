import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { interviewSchema } from '@/lib/validations/interview';

/** 获取某投递的所有面试场次（按 round 正序） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { id } = await params;

  const interviews = await prisma.interview.findMany({
    where: { applicationId: id, userId: session.user.id },
    orderBy: { round: 'asc' },
  });

  return NextResponse.json(interviews);
}

/** 新增面试场次（校验 applicationId 属于当前用户 + 自动写入 userId） */
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

  const { id: applicationId } = await params;

  // 校验 application 属于当前用户
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: session.user.id },
    select: { id: true },
  });
  if (!application) {
    return NextResponse.json({ error: '投递记录不存在' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = interviewSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json({ error: firstError?.message ?? '参数错误' }, { status: 400 });
  }

  const data = parsed.data;
  const interview = await prisma.interview.create({
    data: {
      round: data.round,
      type: data.type,
      scheduledAt: data.scheduledAt,
      durationMin: data.durationMin ?? null,
      location: data.location || null,
      interviewer: data.interviewer || null,
      status: data.status,
      overallNotes: data.overallNotes || null,
      applicationId,
      userId: session.user.id,
    },
  });

  return NextResponse.json(interview, { status: 201 });
}
