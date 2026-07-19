import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';

/**
 * 对比两个快照
 *
 * POST /api/snapshots/diff
 * body: { leftId, rightId }
 *
 * 返回 { left, right }，前端做 diff 渲染。
 * 不在服务端做 diff 是为了让前端能用 JSON 深度 diff 或文本行 diff 灵活切换。
 */
export async function POST(request: Request) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { leftId, rightId } = await request.json();
    if (!leftId || !rightId) {
      return NextResponse.json({ error: '请选择两个快照' }, { status: 400 });
    }

    const [left, right] = await Promise.all([
      prisma.snapshot.findFirst({
        where: { id: leftId, userId: session.user.id },
        select: {
          id: true,
          name: true,
          content: true,
          contentType: true,
          project: true,
          createdAt: true,
        },
      }),
      prisma.snapshot.findFirst({
        where: { id: rightId, userId: session.user.id },
        select: {
          id: true,
          name: true,
          content: true,
          contentType: true,
          project: true,
          createdAt: true,
        },
      }),
    ]);

    if (!left || !right) {
      return NextResponse.json({ error: '快照不存在' }, { status: 404 });
    }

    return NextResponse.json({ left, right });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
