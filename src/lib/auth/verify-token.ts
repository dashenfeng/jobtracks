import { createHmac, timingSafeEqual } from 'crypto';

/**
 * 敏感操作二次认证 Token
 *
 * 用户在 reveal/copy/rotate/export 等敏感操作前需重新输入密码，
 * 验证通过后签发短期 token（5 分钟有效），客户端通过 X-Verify-Token 头携带。
 *
 * Token 格式：base64url(payload).base64url(signature)
 * - payload: { userId, exp }（exp 为秒级 Unix 时间戳）
 * - signature: HMAC-SHA256(payload, AUTH_SECRET)
 */

const TOKEN_TTL_SEC = 5 * 60; // 5 分钟

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET 未配置');
  return secret;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

/** 签发 token */
export function signVerifyToken(userId: string): { token: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const payload = JSON.stringify({ userId, exp });
  const payloadB64 = base64url(payload);
  return { token: `${payloadB64}.${sign(payloadB64)}`, exp };
}

/** 校验 token：返回 { ok, userId?, exp? } */
export function verifyVerifyToken(token: string | null | undefined): {
  ok: boolean;
  userId?: string;
  exp?: number;
} {
  if (!token) return { ok: false };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false };

  const [payloadB64, sig] = parts;
  const expectedSig = sign(payloadB64);

  // 长度不同直接拒绝，避免 timingSafeEqual 抛错
  if (sig.length !== expectedSig.length) return { ok: false };
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return { ok: false };
    }
  } catch {
    return { ok: false };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as {
      userId: string;
      exp: number;
    };
    if (Math.floor(Date.now() / 1000) >= payload.exp) return { ok: false };
    return { ok: true, userId: payload.userId, exp: payload.exp };
  } catch {
    return { ok: false };
  }
}

/** 从 Request 提取并校验 token，返回校验结果 */
export function checkVerifyToken(request: Request): {
  ok: boolean;
  userId?: string;
  exp?: number;
} {
  const token = request.headers.get('x-verify-token');
  return verifyVerifyToken(token);
}
