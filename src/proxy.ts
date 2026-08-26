import { NextResponse, type NextRequest } from 'next/server';
import NextAuth from 'next-auth';

import { authConfig } from '@/auth.config';

/**
 * Next.js 16 中间件（原 middleware.ts，现已改名为 proxy.ts）
 * 运行在 Edge Runtime，只能用 edge 安全的 authConfig
 *
 * 职责：
 * 1. 对所有 mutating API 请求（POST/PATCH/DELETE/PUT）做 Origin 校验（CSRF 防护）
 *    - /api/auth/* 排除：NextAuth 自带 CSRF token 校验
 *    - /api/health 排除：探活请求不做 CSRF
 *    - 路由里不再需要手动调 checkCsrf
 * 2. NextAuth 页面守卫（未登录重定向 /login）
 *    - API 路径（非 auth）由 API route 自己鉴权，返回 401 JSON
 */
const { auth } = NextAuth(authConfig);

export const proxy = (request: NextRequest) => {
  const method = request.method.toUpperCase();
  const { pathname } = request.nextUrl;

  // 1. mutating API 请求 → CSRF Origin 校验
  const isMutating = ['POST', 'PATCH', 'DELETE', 'PUT'].includes(method);
  const isApiRoute = pathname.startsWith('/api/');
  const isAuthRoute = pathname.startsWith('/api/auth/');
  const isHealthRoute = pathname === '/api/health';

  if (isMutating && isApiRoute && !isAuthRoute && !isHealthRoute) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    if (!origin || !host) {
      return NextResponse.json(
        { error: '缺少 Origin 或 Host 头' },
        { status: 403 },
      );
    }

    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json(
          { error: 'Origin 校验失败' },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Origin 格式错误' },
        { status: 403 },
      );
    }
  }

  // 2. 非 API 路由 → 交给 NextAuth 守卫
  if (!isApiRoute) {
    return auth(request as never);
  }

  // 3. 其他请求（GET API、auth API、health）直接放行
  return NextResponse.next();
};

export const config = {
  /**
   * 匹配所有路由
   * - mutating API → CSRF 校验
   * - 页面路由 → NextAuth 守卫
   * - GET API / auth API / health → 直接放行
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
