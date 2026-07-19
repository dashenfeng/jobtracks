import { NextResponse } from 'next/server';
import { AuditAction } from '@prisma/client';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { rateLimit, getClientIp } from '@/lib/auth/rate-limit';
import { checkVerifyToken } from '@/lib/auth/verify-token';
import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/crypto/aes';

/**
 * 密钥轮换：重新加密当前用户的所有 EnvVault value（生成新 IV）
 *
 * POST /api/envvault/rotate
 * - 需二次认证（X-Verify-Token）
 * - 限流：单 IP 3 次/小时
 * - 审计日志：ROTATE
 *
 * 适用场景：怀疑密文泄露，需要让旧密文失效
 */
export async function POST(request: Request) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 二次认证
  const verify = checkVerifyToken(request);
  if (!verify.ok || verify.userId !== session.user.id) {
    return NextResponse.json(
      { error: '需要二次认证', code: 'VERIFY_REQUIRED' },
      { status: 401 },
    );
  }

  // 限流
  const ip = getClientIp(request);
  if (!rateLimit(`rotate:${ip}`, 3, 3_600_000)) {
    return NextResponse.json({ error: '轮换操作过于频繁' }, { status: 429 });
  }

  try {
    const records = await prisma.envVault.findMany({
      where: { userId: session.user.id },
      select: { id: true, value: true },
    });

    let rotated = 0;
    let failed = 0;

    // 逐条重新加密（decrypt → encrypt 生成新 IV）
    for (const r of records) {
      try {
        const plaintext = decrypt(r.value);
        const newCiphertext = encrypt(plaintext);
        await prisma.envVault.update({
          where: { id: r.id },
          data: { value: newCiphertext },
        });
        rotated++;
      } catch {
        // 单条解密失败跳过，不影响其他
        failed++;
      }
    }

    // 审计日志
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: AuditAction.ROTATE,
        targetType: 'EnvVault',
        targetId: 'all',
        metadata: { rotated, failed, total: records.length },
      },
    });

    return NextResponse.json({ rotated, failed, total: records.length });
  } catch (error) {
    console.error('[envvault rotate] error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
