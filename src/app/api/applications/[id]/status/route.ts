import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { notifyApplicationStatusChanged } from '@/lib/notifications/service';
import { statusUpdateSchema } from '@/lib/validations/application';

/**
 * 状态快速流转：仅更新某条投递的 status
 * 用于列表/详情页的 StatusSwitcher
 */
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
  const parsed = statusUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  // 确认记录存在且属于当前用户
  const existing = await prisma.application.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, status: true, companyName: true, jobTitle: true },
  });
  if (!existing) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  const application = await prisma.application.update({
    where: { id },
    data: { status: parsed.data.status },
    select: { id: true, status: true, updatedAt: true },
  });

  // 状态变更通知（异步触发，不阻塞响应；失败不影响更新结果）
  if (existing.status !== parsed.data.status) {
    notifyApplicationStatusChanged(
      session.user.id,
      { id: existing.id, companyName: existing.companyName, jobTitle: existing.jobTitle },
      existing.status,
      parsed.data.status,
    ).catch((e) => console.error('[notifications] status change notify failed:', e));
  }

  return NextResponse.json(application);
}
