import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto/aes';
import { envVaultSchema, MASKED_VALUE } from '@/lib/validations/envvault';

/** 获取 EnvVault 列表（value 掩码，支持 ?q=keyword 模糊搜索 key/tags） */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';

    const where = {
      userId: session.user.id,
      ...(q
        ? {
            OR: [
              { key: { contains: q, mode: 'insensitive' as const } },
              { tags: { has: q } },
            ],
          }
        : {}),
    };

    const records = await prisma.envVault.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    const items = records.map(({ value, ...rest }) => ({
      ...rest,
      value: MASKED_VALUE,
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

/** 新增 EnvVault 条目（value 加密入库，重复 key 返回 409） */
export async function POST(request: Request) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = envVaultSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? '参数错误' },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // 检查 key 是否重复（[userId, key] 唯一约束）
    const duplicate = await prisma.envVault.findFirst({
      where: { userId: session.user.id, key: data.key },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: '键名已存在' }, { status: 409 });
    }

    const created = await prisma.envVault.create({
      data: {
        key: data.key,
        value: encrypt(data.value),
        tags: data.tags,
        notes: data.notes || null,
        userId: session.user.id,
      },
    });

    // 审计日志：CREATE
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        targetType: 'EnvVault',
        targetId: created.id,
        metadata: { key: created.key },
      },
    });

    const { value, ...rest } = created;
    return NextResponse.json({ ...rest, value: MASKED_VALUE }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
