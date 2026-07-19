import { NextResponse } from 'next/server';
import { AuditAction } from '@prisma/client';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { rateLimit, getClientIp } from '@/lib/auth/rate-limit';
import { checkVerifyToken } from '@/lib/auth/verify-token';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto/aes';

/**
 * 查看明文：解密 value 返回，同时累计访问计数并写入审计日志
 * - 需二次认证（X-Verify-Token）
 * - 限流：单 IP 30 次/分钟
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 二次认证
  const verify = checkVerifyToken(request);
  if (!verify.ok || verify.userId !== session.user.id) {
    return NextResponse.json({ error: '需要二次认证', code: 'VERIFY_REQUIRED' }, { status: 401 });
  }

  // 限流
  const ip = getClientIp(request);
  if (!rateLimit(`reveal:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, { status: 429 });
  }

  const { id } = await params;

  // 确认记录存在且属于当前用户（同时取 key 用于审计日志）
  const record = await prisma.envVault.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, key: true, value: true },
  });
  if (!record) {
    return NextResponse.json({ error: '不存在' }, { status: 404 });
  }

  let plaintext: string;
  try {
    plaintext = decrypt(record.value);
  } catch {
    return NextResponse.json({ error: '解密失败' }, { status: 500 });
  }

  await prisma.$transaction([
    prisma.envVault.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        action: AuditAction.VIEW,
        targetType: 'EnvVault',
        targetId: id,
        userId: session.user.id,
        metadata: { key: record.key },
      },
    }),
  ]);

  return NextResponse.json({ value: plaintext });
}
