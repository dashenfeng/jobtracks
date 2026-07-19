import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { changelogSchema } from '@/lib/validations/changelog';

/**
 * Changelog 列表与创建
 *
 * GET /api/changelogs?q=&type=
 * POST /api/changelogs
 */

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const type = searchParams.get('type')?.trim() || '';

    const where = {
      userId: session.user.id,
      ...(q
        ? {
            OR: [
              { version: { contains: q, mode: 'insensitive' as const } },
              {
                changes: {
                  some: { description: { contains: q, mode: 'insensitive' as const } },
                },
              },
            ],
          }
        : {}),
      ...(type ? { changes: { some: { type: type as 'NEW' | 'FIX' | 'IMPROVED' | 'BREAKING' } } } : {}),
    };

    const items = await prisma.changelog.findMany({
      where,
      orderBy: { releasedAt: 'desc' },
      select: {
        id: true,
        version: true,
        releasedAt: true,
        screenshots: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { changes: true } },
      },
    });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = changelogSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? '参数错误' },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // 校验版本号在用户范围内唯一
    const existing = await prisma.changelog.findFirst({
      where: { userId: session.user.id, version: data.version },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: '版本号已存在' }, { status: 400 });
    }

    const created = await prisma.changelog.create({
      data: {
        version: data.version,
        releasedAt: new Date(data.releasedAt),
        screenshots: data.screenshots,
        userId: session.user.id,
        changes: {
          create: data.changes.map((c) => ({
            type: c.type,
            description: c.description,
          })),
        },
      },
      select: {
        id: true,
        version: true,
        releasedAt: true,
        screenshots: true,
        createdAt: true,
        changes: { select: { id: true, type: true, description: true } },
      },
    });

    // 审计日志
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        targetType: 'Changelog',
        targetId: created.id,
        metadata: { version: created.version, changeCount: created.changes.length },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
