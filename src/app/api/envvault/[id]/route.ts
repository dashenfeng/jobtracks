import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto/aes';
import { envVaultUpdateSchema, MASKED_VALUE } from '@/lib/validations/envvault';

/** 获取单条 EnvVault 详情（value 掩码，不解密） */
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
    const record = await prisma.envVault.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!record) {
      return NextResponse.json({ error: '不存在' }, { status: 404 });
    }

    const { value, ...rest } = record;
    return NextResponse.json({ ...rest, value: MASKED_VALUE });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

/** 更新 EnvVault 条目（value 若传则重新加密） */
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
    const parsed = envVaultUpdateSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? '参数错误' },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // 确认记录存在且属于当前用户
    const existing = await prisma.envVault.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: '不存在' }, { status: 404 });
    }

    // 部分更新：只更新明确传入的字段
    const updateData: Record<string, unknown> = {};
    if (data.key !== undefined) updateData.key = data.key;
    if (data.value !== undefined) updateData.value = encrypt(data.value);
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    const updated = await prisma.envVault.update({
      where: { id },
      data: updateData,
    });

    // 审计日志：UPDATE
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        targetType: 'EnvVault',
        targetId: id,
        metadata: { key: updated.key },
      },
    });

    const { value, ...rest } = updated;
    return NextResponse.json({ ...rest, value: MASKED_VALUE });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

/** 删除 EnvVault 条目（校验归属） */
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

    // 确认记录存在且属于当前用户（同时取 key 用于审计日志）
    const existing = await prisma.envVault.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, key: true },
    });
    if (!existing) {
      return NextResponse.json({ error: '不存在' }, { status: 404 });
    }

    await prisma.envVault.delete({ where: { id } });

    // 审计日志：DELETE
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        targetType: 'EnvVault',
        targetId: id,
        metadata: { key: existing.key },
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
