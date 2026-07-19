import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { rateLimit, getClientIp } from '@/lib/auth/rate-limit';
import { prisma } from '@/lib/db';
import { signVerifyToken } from '@/lib/auth/verify-token';

const schema = z.object({
  password: z.string().min(1, '请输入密码'),
});

/**
 * 敏感操作二次认证：校验当前用户密码，签发 5 分钟有效的 verify-token
 *
 * POST /api/auth/verify-password
 * → 200 { token, exp } ｜ 401 密码错误 ｜ 429 限流
 */
export async function POST(request: Request) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 限流：单 IP 10 次/分钟，防止暴力破解
  const ip = getClientIp(request);
  if (!rateLimit(`verify:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: '尝试过于频繁，请稍后再试' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '参数错误' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user?.password) {
      return NextResponse.json({ error: '账户未设置密码' }, { status: 400 });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.password);
    if (!valid) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }

    const { token, exp } = signVerifyToken(session.user.id);
    return NextResponse.json({ token, exp });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
