import { NextResponse } from 'next/server';

/**
 * 中间件：统一安全层
 *
 * 职责：
 * 1. 对所有 mutating 请求（POST/PATCH/DELETE/PUT）做 Origin 校验（CSRF 防护）
 *    - 路由里不再需要手动调 checkCsrf，但保留 checkCsrf 函数供特殊场景使用
 *    - /api/auth/* 排除：NextAuth 自带 CSRF token 校验
 *    - /api/health 排除：探活请求不做 CSRF
 *
 * 2. 安全 headers 由 next.config.ts 的 headers() 配置，不在此重复
 *
 * 匹配规则：
 * - matcher 精确匹配 /api/* 路径，排除 _next/static / _next/image / favicon.ico
 */
export function middleware(request: Request) {
  const method = request.method.toUpperCase();

  // 只拦截 mutating 请求
  const isMutating = ['POST', 'PATCH', 'DELETE', 'PUT'].includes(method);
  if (!isMutating) {
    return NextResponse.next();
  }

  const { pathname } = new URL(request.url);

  // NextAuth 自带 CSRF token 校验
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // 健康检查不做 CSRF
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  // Origin 校验
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

  return NextResponse.next();
}

export const config = {
  /**
   * 匹配所有 /api 路由
   * 排除 Next.js 内部静态资源
   */
  matcher: ['/api/:path*'],
};
