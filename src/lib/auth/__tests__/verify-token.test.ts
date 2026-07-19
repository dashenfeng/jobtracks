import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'crypto';
import { signVerifyToken, verifyVerifyToken, checkVerifyToken } from '../verify-token';

const ORIGINAL_SECRET = process.env.AUTH_SECRET;

describe('verify-token', () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = 'test-secret-for-vitest-12345';
  });

  afterAll(() => {
    process.env.AUTH_SECRET = ORIGINAL_SECRET;
  });

  describe('signVerifyToken', () => {
    it('签发 token 包含两段（payload.signature）', () => {
      const { token } = signVerifyToken('user-1');
      expect(token.split('.')).toHaveLength(2);
    });

    it('签发 exp 为当前时间 + 5 分钟', () => {
      const before = Math.floor(Date.now() / 1000) + 300 - 1;
      const { exp } = signVerifyToken('user-1');
      const after = Math.floor(Date.now() / 1000) + 300 + 1;
      expect(exp).toBeGreaterThanOrEqual(before);
      expect(exp).toBeLessThanOrEqual(after);
    });
  });

  describe('verifyVerifyToken', () => {
    it('合法 token 校验通过，返回 userId 和 exp', () => {
      const { token, exp } = signVerifyToken('user-abc');
      const result = verifyVerifyToken(token);
      expect(result.ok).toBe(true);
      expect(result.userId).toBe('user-abc');
      expect(result.exp).toBe(exp);
    });

    it('null/undefined 返回 ok: false', () => {
      expect(verifyVerifyToken(null).ok).toBe(false);
      expect(verifyVerifyToken(undefined).ok).toBe(false);
      expect(verifyVerifyToken('').ok).toBe(false);
    });

    it('格式错误（段数不对）返回 ok: false', () => {
      expect(verifyVerifyToken('abc').ok).toBe(false);
      expect(verifyVerifyToken('a.b.c').ok).toBe(false);
    });

    it('签名被篡改返回 ok: false', () => {
      const { token } = signVerifyToken('user-1');
      const [payload, sig] = token.split('.');
      // 篡改 signature
      const tamperedSig = sig.slice(0, -2) + 'XX';
      expect(verifyVerifyToken(`${payload}.${tamperedSig}`).ok).toBe(false);
      // 篡改 payload
      const tamperedPayload = payload.slice(0, -2) + 'AA';
      expect(verifyVerifyToken(`${tamperedPayload}.${sig}`).ok).toBe(false);
    });

    it('payload 无法反序列化返回 ok: false', () => {
      const fakePayload = Buffer.from('not-json').toString('base64url');
      const sig = createHmac('sha256', process.env.AUTH_SECRET!)
        .update(fakePayload)
        .digest('base64url');
      expect(verifyVerifyToken(`${fakePayload}.${sig}`).ok).toBe(false);
    });
  });

  describe('checkVerifyToken', () => {
    it('从 Request 的 X-Verify-Token 头提取并校验', () => {
      const { token } = signVerifyToken('user-req');
      const req = new Request('https://example.com', {
        headers: { 'X-Verify-Token': token },
      });
      const result = checkVerifyToken(req);
      expect(result.ok).toBe(true);
      expect(result.userId).toBe('user-req');
    });

    it('缺少头返回 ok: false', () => {
      const req = new Request('https://example.com');
      expect(checkVerifyToken(req).ok).toBe(false);
    });
  });

  describe('不同密钥', () => {
    it('AUTH_SECRET 变更后旧 token 失效', () => {
      const { token } = signVerifyToken('user-1');
      process.env.AUTH_SECRET = 'another-secret-xyz';
      expect(verifyVerifyToken(token).ok).toBe(false);
      // 恢复
      process.env.AUTH_SECRET = 'test-secret-for-vitest-12345';
    });
  });
});
