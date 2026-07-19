import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { snapshotUpdateSchema } from '@/lib/validations/snapshot';

/**
 * 单条快照的查/改/删
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
    const record = await prisma.snapshot.findFirst({
      where: { id, userId: session.user.id },
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
    const parsed = snapshotUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? '参数错误' },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const existing = await prisma.snapshot.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: '不存在' }, { status: 404 });
    }

    // 若改 baselineId，校验其存在
    if (data.baselineId) {
      const baseline = await prisma.snapshot.findFirst({
        where: { id: data.baselineId, userId: session.user.id },
        select: { id: true },
      });
      if (!baseline) {
        return NextResponse.json({ error: '基准快照不存在' }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.content !== undefined) {
      updateData.content = data.content;
      updateData.contentLength = data.content.length;
    }
    if (data.contentType !== undefined) updateData.contentType = data.contentType;
    if (data.remarks !== undefined) updateData.remarks = data.remarks || null;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.project !== undefined) updateData.project = data.project || null;
    if (data.isBaseline !== undefined) updateData.isBaseline = data.isBaseline;
    if (data.baselineId !== undefined) updateData.baselineId = data.baselineId || null;

    const updated = await prisma.snapshot.update({
      where: { id },
      data: updateData,
    });

    // 审计日志
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        targetType: 'Snapshot',
        targetId: id,
        metadata: { name: updated.name },
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

    const existing = await prisma.snapshot.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json({ error: '不存在' }, { status: 404 });
    }

    await prisma.snapshot.delete({ where: { id } });

    // 审计日志
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        targetType: 'Snapshot',
        targetId: id,
        metadata: { name: existing.name },
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
