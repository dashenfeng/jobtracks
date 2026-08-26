import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { authConfig } from '@/auth.config';
import { authorizeCredentials } from '@/lib/auth/authorize';

/**
 * 完整配置（Node Runtime）—— Credentials provider + JWT session
 * 不使用 PrismaAdapter（adapter 是给 OAuth 用的，Credentials 手动查库）
 *
 * authorize 逻辑提取到 src/lib/auth/authorize.ts，便于单元测试
 * （next-auth 内部 import 'next/server' 在 vitest 下解析失败）
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
      authorize: authorizeCredentials,
    }),
  ],
});
