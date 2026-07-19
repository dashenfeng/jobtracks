import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { rateLimit, getClientIp } from '@/lib/auth/rate-limit';
import { checkVerifyToken } from '@/lib/auth/verify-token';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto/aes';

/**
 * 导出为 .env 格式文本（批量解密所有明文）
 *
 * POST /api/envvault/export
 * - 需二次认证（X-Verify-Token）
 * - 限流：单 IP 5 次/小时（批量解密是最高风险操作）
 * - 审计日志：每条解密的 key 记录一条 COPY
 *
 * 返回 text/plain，Content-Disposition: attachment
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

  // 限流：批量解密是最高风险操作，严格限制
  const ip = getClientIp(request);
  if (!rateLimit(`export:${ip}`, 5, 3_600_000)) {
    return NextResponse.json({ error: '导出过于频繁，每小时仅 5 次' }, { status: 429 });
  }

  try {
    const records = await prisma.envVault.findMany({
      where: { userId: session.user.id },
      orderBy: { key: 'asc' },
      select: { id: true, key: true, value: true },
    });

    const lines = records.map((r) => {
      let plaintext: string;
      try {
        plaintext = decrypt(r.value);
      } catch {
        plaintext = '';
      }
      if (/[\s#"']/.test(plaintext)) {
        const escaped = plaintext.replace(/"/g, '\\"');
        return `${r.key}="${escaped}"`;
      }
      return `${r.key}=${plaintext}`;
    });

    const content = lines.join('\n') + '\n';

    // 批量写审计日志
    await prisma.auditLog.createMany({
      data: records.map((r) => ({
        userId: session.user.id,
        action: 'COPY',
        targetType: 'EnvVault',
        targetId: r.id,
        metadata: { key: r.key, source: 'export' },
      })),
    });

    const now = new Date();
    const ts =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      '-' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="env-export-${ts}.env"`,
      },
    });
  } catch (error) {
    console.error('[envvault export] error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
