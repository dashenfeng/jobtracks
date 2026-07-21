import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { applicationSchema } from '@/lib/validations/application';
import { notifyApplicationStatusChanged } from '@/lib/notifications/service';

/** 获取单个投递详情 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { id } = await params;
  const application = await prisma.application.findFirst({
    where: { id, userId: session.user.id },
    include: { attachments: true },
  });

  if (!application) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  return NextResponse.json(application);
}

/** 更新投递 */
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
  const body = await request.json();
  const parsed = applicationSchema.safeParse(body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json({ error: firstError?.message ?? '参数错误' }, { status: 400 });
  }

  const data = parsed.data;

  // 确认记录存在且属于当前用户
  const existing = await prisma.application.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  const application = await prisma.application.update({
    where: { id },
    data: {
      ...data,
      jobUrl: data.jobUrl || null,
      city: data.city || null,
      salaryRange: data.salaryRange || null,
      notes: data.notes || null,
    },
  });

  // 投递状态变更通知（异步触发，不阻塞响应；失败不影响更新结果）
  if (data.status && existing.status !== data.status) {
    notifyApplicationStatusChanged(
      session.user.id,
      { id: application.id, companyName: application.companyName, jobTitle: application.jobTitle },
      existing.status,
      data.status,
    ).catch((e) => console.error('[notifications] status change notify failed:', e));
  }

  return NextResponse.json(application);
}

/** 删除投递 */
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
  const existing = await prisma.application.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  await prisma.application.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
