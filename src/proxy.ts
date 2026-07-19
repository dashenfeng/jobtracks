import NextAuth from 'next-auth';

import { authConfig } from '@/auth.config';

/**
 * Next.js 16 中间件（原 middleware.ts，现已改名为 proxy.ts）
 * 运行在 Edge Runtime，只能用 edge 安全的 authConfig
 */
const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  // 中间件只守卫页面路径
  // API 路径（非 auth）由 API route 自己鉴权，返回 401 JSON
  // /api/auth 需要 NextAuth 中间件处理（CSRF、session 等）
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/(?!auth)).*)'],
};
