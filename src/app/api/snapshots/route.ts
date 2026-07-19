import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { snapshotSchema } from '@/lib/validations/snapshot';

/**
 * 快照列表与创建
 *
 * GET /api/snapshots?q=&project=&contentType=&isBaseline=
 * POST /api/snapshots
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const project = searchParams.get('project')?.trim() || '';
    const contentType = searchParams.get('contentType')?.trim() || '';
    const isBaseline = searchParams.get('isBaseline');

    const where = {
      userId: session.user.id,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { remarks: { contains: q, mode: 'insensitive' as const } },
              { tags: { has: q } },
            ],
          }
        : {}),
      ...(project ? { project } : {}),
      ...(contentType ? { contentType } : {}),
      ...(isBaseline === 'true' ? { isBaseline: true } : {}),
      ...(isBaseline === 'false' ? { isBaseline: false } : {}),
    };

    const items = await prisma.snapshot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        contentType: true,
        remarks: true,
        tags: true,
        project: true,
        isBaseline: true,
        baselineId: true,
        contentLength: true,
        createdAt: true,
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
    const parsed = snapshotSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? '参数错误' },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // 若指定了 baselineId，校验其存在且属于当前用户
    if (data.baselineId) {
      const baseline = await prisma.snapshot.findFirst({
        where: { id: data.baselineId, userId: session.user.id },
        select: { id: true },
      });
      if (!baseline) {
        return NextResponse.json({ error: '基准快照不存在' }, { status: 400 });
      }
    }

    const created = await prisma.snapshot.create({
      data: {
        name: data.name,
        content: data.content,
        contentType: data.contentType,
        remarks: data.remarks || null,
        tags: data.tags,
        project: data.project || null,
        isBaseline: data.isBaseline,
        baselineId: data.baselineId || null,
        contentLength: data.content.length,
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        contentType: true,
        remarks: true,
        tags: true,
        project: true,
        isBaseline: true,
        baselineId: true,
        contentLength: true,
        createdAt: true,
      },
    });

    // 审计日志
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        targetType: 'Snapshot',
        targetId: created.id,
        metadata: { name: created.name, contentType: created.contentType },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
