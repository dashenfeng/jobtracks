import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { changelogUpdateSchema } from '@/lib/validations/changelog';

/**
 * 单条 Changelog 的查/改/删
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const record = await prisma.changelog.findFirst({
      where: { id, userId: session.user.id },
      select: {
        id: true,
        version: true,
        releasedAt: true,
        screenshots: true,
        createdAt: true,
        updatedAt: true,
        changes: {
          orderBy: { id: 'asc' },
          select: { id: true, type: true, description: true },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: '不存在' }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = changelogUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? '参数错误' },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const existing = await prisma.changelog.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, version: true },
    });
    if (!existing) {
      return NextResponse.json({ error: '不存在' }, { status: 404 });
    }

    // 版本号唯一性校验（如修改了版本号）
    if (data.version && data.version !== existing.version) {
      const dup = await prisma.changelog.findFirst({
        where: { userId: session.user.id, version: data.version, NOT: { id } },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json({ error: '版本号已存在' }, { status: 400 });
      }
    }

    // 事务：更新基础字段 + 整体替换 changes
    const updated = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (data.version !== undefined) updateData.version = data.version;
      if (data.releasedAt !== undefined) updateData.releasedAt = new Date(data.releasedAt);
      if (data.screenshots !== undefined) updateData.screenshots = data.screenshots;

      if (Object.keys(updateData).length > 0) {
        await tx.changelog.update({ where: { id }, data: updateData });
      }

      // changes 整体替换：删除旧的 + 创建新的
      if (data.changes !== undefined) {
        await tx.change.deleteMany({ where: { changelogId: id } });
        if (data.changes.length > 0) {
          await tx.change.createMany({
            data: data.changes.map((c) => ({
              type: c.type,
              description: c.description,
              changelogId: id,
            })),
          });
        }
      }

      return tx.changelog.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          version: true,
          releasedAt: true,
          screenshots: true,
          createdAt: true,
          updatedAt: true,
          changes: {
            orderBy: { id: 'asc' },
            select: { id: true, type: true, description: true },
          },
        },
      });
    });

    // 审计日志
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        targetType: 'Changelog',
        targetId: id,
        metadata: { version: updated.version },
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.changelog.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, version: true },
    });
    if (!existing) {
      return NextResponse.json({ error: '不存在' }, { status: 404 });
    }

    // 级联删除 changes（schema 已配置 onDelete: Cascade）
    await prisma.changelog.delete({ where: { id } });

    // 审计日志
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        targetType: 'Changelog',
        targetId: id,
        metadata: { version: existing.version },
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
