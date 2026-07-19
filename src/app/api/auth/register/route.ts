import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { checkCsrf } from '@/lib/auth/csrf';
import { rateLimit, getClientIp } from '@/lib/auth/rate-limit';
import { prisma } from '@/lib/db';

const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z
    .string()
    .min(8, '密码至少 8 位')
    .regex(/[a-zA-Z]/, '密码必须包含字母')
    .regex(/\d/, '密码必须包含数字'),
  name: z.string().min(1, '昵称不能为空').max(20, '昵称最多 20 字').optional().or(z.literal('')),
});

export async function POST(request: Request) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  // 限流：单 IP 3 次/小时，防止批量注册
  const ip = getClientIp(request);
  if (!rateLimit(`register:${ip}`, 3, 3_600_000)) {
    return NextResponse.json({ error: '注册过于频繁，请稍后再试' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json({ error: firstError?.message ?? '参数错误' }, { status: 400 });
    }

    const { email, password, name } = parsed.data;

    // 检查邮箱是否已注册
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: '该邮箱已被注册' }, { status: 409 });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (error) {
    console.error('[register] error:', error);
    return NextResponse.json({ error: '服务器错误，请稍后重试' }, { status: 500 });
  }
}
