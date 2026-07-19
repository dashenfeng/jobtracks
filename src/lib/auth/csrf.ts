import { NextResponse } from 'next/server';

/**
 * CSRF 保护：校验 Origin 头
 * 防止跨站表单提交攻击（NextAuth 的 /api/auth/* 自带 CSRF 保护，无需调用此函数）
 *
 * 使用方式（在 mutating route handler 顶部）：
 *   const csrfError = checkCsrf(request);
 *   if (csrfError) return csrfError;
 */
export function checkCsrf(request: Request): NextResponse | null {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  // 同源请求：origin 的 host 必须等于 host 头
  if (!origin || !host) {
    return NextResponse.json({ error: '缺少 Origin 或 Host 头' }, { status: 403 });
  }

  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return NextResponse.json({ error: 'Origin 校验失败' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Origin 格式错误' }, { status: 403 });
  }

  return null;
}
