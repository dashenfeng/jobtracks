import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';

/** 标记单条通知为已读 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const result = await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: '通知不存在或无权访问' }, { status: 404 });
  }
  return NextResponse.json({ updated: result.count });
}

/** 删除单条通知 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const result = await prisma.notification.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: '通知不存在或无权访问' }, { status: 404 });
  }
  return NextResponse.json({ deleted: result.count });
}
