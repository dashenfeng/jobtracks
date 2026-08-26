import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/auth/rate-limit';

/**
 * 登录校验逻辑（独立模块，便于单元测试，不依赖 next-auth）
 *
 * 校验策略：与注册路由保持一致
 * - 邮箱：z.string().email()
 * - 密码：min(8) + 字母 + 数字（注册路由同款校验）
 *
 * 设计说明：
 * - 项目从零开发，注册时即强制 8 位 + 字母 + 数字，DB 里无 < 8 位的密码
 * - 登录用相同 schema，让 6-7 位无效请求在 schema 阶段短路，不查库
 *
 * @returns 返回 { id, email, name } 或 null
 */
export async function authorizeCredentials(credentials: unknown) {
  const parsed = z
    .object({
      email: z.string().email(),
      password: z
        .string()
        .min(8, '密码至少 8 位')
        .regex(/[a-zA-Z]/, '密码必须包含字母')
        .regex(/\d/, '密码必须包含数字'),
    })
    .safeParse(credentials);

  if (!parsed.success) return null;

  const { email, password } = parsed.data;

  // 限流：单邮箱 5 次/分钟，防止暴力破解
  if (!rateLimit(`login:${email}`, 5, 60_000)) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.password) return null;

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return null;

  return { id: user.id, email: user.email, name: user.name };
}
