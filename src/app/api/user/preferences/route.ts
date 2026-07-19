import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { mergePreferences, UserPreferences } from '@/lib/types/user';

/** 获取当前用户偏好 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  });

  return NextResponse.json(mergePreferences(user?.preferences));
}

const updateSchema = z.object({
  salaryMaskEnabled: z.boolean().optional(),
});

/** 更新偏好（merge 模式，只传需要改的字段） */
export async function PATCH(request: Request) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  // 读取现有偏好，merge 新值
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  });
  const current = mergePreferences(user?.preferences);
  const next: UserPreferences = { ...current, ...parsed.data };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { preferences: next as object },
  });

  return NextResponse.json(next);
}
