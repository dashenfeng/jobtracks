import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';
import { scanInterviewReminders } from '@/lib/notifications/service';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.coerce.boolean().optional().default(false),
});

/**
 * 通知列表 + 未读数
 *
 * GET /api/notifications?page=1&pageSize=20&unreadOnly=false
 *
 * 访问时顺带触发面试扫描（懒扫描策略，无需 cron）
 * - 每次请求都扫描，但 service 内部用 metadata.interviewId 去重，不会重复生成
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const userId = session.user.id;

  // 懒扫描：用户访问通知时触发面试提醒扫描
  try {
    await scanInterviewReminders(userId);
  } catch (e) {
    // 扫描失败不影响列表读取
    console.error('[notifications] scan failed:', e);
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    page: url.searchParams.get('page') ?? 1,
    pageSize: url.searchParams.get('pageSize') ?? 20,
    unreadOnly: url.searchParams.get('unreadOnly') === 'true',
  });
  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
  const { page, pageSize, unreadOnly } = parsed.data;

  const where = {
    userId,
    ...(unreadOnly ? { read: false } : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    unreadCount,
  });
}

/** 全部已读 / 清空 */
const bodySchema = z.object({
  action: z.enum(['mark_all_read', 'clear_all']),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const { action } = parsed.data;

  if (action === 'mark_all_read') {
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return NextResponse.json({ updated: result.count });
  }

  // clear_all
  const result = await prisma.notification.deleteMany({
    where: { userId },
  });
  return NextResponse.json({ deleted: result.count });
}
