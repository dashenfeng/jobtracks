import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/auth/rate-limit';

/**
 * 登录校验逻辑（独立模块，便于单元测试，不依赖 next-auth）
 *
 * 校验策略说明：
 * - 注册路由要求 min(8) + 字母 + 数字（强密码）
 * - 登录只要求 min(6)（宽松校验，兼容历史用户 + 防无效请求打 DB）
 * - 即使传 6-7 位密码能通过 schema，bcrypt.compare 也会失败（DB 里的 hash 都至少 8 位）
 *
 * @returns 返回 { id, email, name } 或 null
 */
export async function authorizeCredentials(credentials: unknown) {
  const parsed = z
    .object({
      email: z.string().email(),
      password: z.string().min(6),
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
