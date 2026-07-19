import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { authConfig } from '@/auth.config';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/auth/rate-limit';

/**
 * 完整配置（Node Runtime）—— Credentials provider + JWT session
 * 不使用 PrismaAdapter（adapter 是给 OAuth 用的，Credentials 手动查库）
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
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
      },
    }),
  ],
});
