import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  AuditAction: {
    VIEW: 'VIEW',
    COPY: 'COPY',
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    ROTATE: 'ROTATE',
  },
}));

vi.mock('@/lib/auth/full-config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/auth/csrf', () => ({
  checkCsrf: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/auth/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue(true),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  _resetRateLimitForTest: vi.fn(),
}));

vi.mock('@/lib/auth/verify-token', () => ({
  checkVerifyToken: vi.fn(),
}));

vi.mock('@/lib/crypto/aes', () => ({
  decrypt: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    envVault: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((args) => Promise.all(args)),
  },
}));

import { POST } from '@/app/api/envvault/[id]/reveal/route';
import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { rateLimit } from '@/lib/auth/rate-limit';
import { checkVerifyToken } from '@/lib/auth/verify-token';
import { decrypt } from '@/lib/crypto/aes';
import { prisma } from '@/lib/db';
import { _resetRateLimitForTest } from '@/lib/auth/rate-limit';
import { NextResponse } from 'next/server';

const mockedAuth = vi.mocked(auth);
const mockedCheckCsrf = vi.mocked(checkCsrf);
const mockedRateLimit = vi.mocked(rateLimit);
const mockedCheckVerifyToken = vi.mocked(checkVerifyToken);
const mockedDecrypt = vi.mocked(decrypt);
const mockedFindFirst = vi.mocked(prisma.envVault.findFirst);
const mockedUpdate = vi.mocked(prisma.envVault.update);
const mockedAuditCreate = vi.mocked(prisma.auditLog.create);

const ORIGIN = 'http://localhost:3000';
const HOST = 'localhost:3000';

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(): Request {
  return new Request('http://localhost:3000/api/envvault/v1/reveal', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      host: HOST,
      'X-Verify-Token': 'valid-token',
    },
  });
}

describe('POST /api/envvault/[id]/reveal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimitForTest();
    // 默认 mock 都通过
    mockedCheckCsrf.mockReturnValue(null);
    mockedRateLimit.mockReturnValue(true);
    mockedCheckVerifyToken.mockReturnValue({ ok: true, userId: 'u1' });
  });

  it('CSRF 失败 → 403', async () => {
    mockedCheckCsrf.mockReturnValueOnce(
      new NextResponse('Forbidden', { status: 403 }) as never,
    );
    const res = await POST(makeRequest(), makeContext('v1'));
    expect(res.status).toBe(403);
    expect(mockedAuth).not.toHaveBeenCalled();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await POST(makeRequest(), makeContext('v1'));
    expect(res.status).toBe(401);
  });

  it('未通过二次认证 → 401 + VERIFY_REQUIRED', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedCheckVerifyToken.mockReturnValueOnce({ ok: false } as never);

    const res = await POST(makeRequest(), makeContext('v1'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('VERIFY_REQUIRED');
  });

  it('token.userId ≠ session.user.id → 401', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedCheckVerifyToken.mockReturnValueOnce({
      ok: true,
      userId: 'other-user',
    } as never);

    const res = await POST(makeRequest(), makeContext('v1'));
    expect(res.status).toBe(401);
  });

  it('触发限流 → 429', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedRateLimit.mockReturnValueOnce(false);

    const res = await POST(makeRequest(), makeContext('v1'));
    expect(res.status).toBe(429);
  });

  it('记录不存在 → 404', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindFirst.mockResolvedValueOnce(null as never);

    const res = await POST(makeRequest(), makeContext('non-existent'));
    expect(res.status).toBe(404);
  });

  it('解密失败 → 500', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindFirst.mockResolvedValueOnce({
      id: 'v1',
      key: 'API_KEY',
      value: 'encrypted-blob',
    } as never);
    mockedDecrypt.mockImplementationOnce(() => {
      throw new Error('decrypt failed');
    });

    const res = await POST(makeRequest(), makeContext('v1'));
    expect(res.status).toBe(500);
  });

  it('成功解密 → 200 + 返回明文 + 累计 viewCount + 审计 VIEW', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindFirst.mockResolvedValueOnce({
      id: 'v1',
      key: 'API_KEY',
      value: 'encrypted-blob',
    } as never);
    mockedDecrypt.mockReturnValueOnce('sk-real-value');
    mockedUpdate.mockResolvedValueOnce({} as never);
    mockedAuditCreate.mockResolvedValueOnce({ id: 'a1' } as never);

    const res = await POST(makeRequest(), makeContext('v1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.value).toBe('sk-real-value');
    // 验证 viewCount 累计
    const updateArgs = mockedUpdate.mock.calls[0]![0]! as any;
    expect(updateArgs.data).toMatchObject({
      viewCount: { increment: 1 },
      lastViewedAt: expect.any(Date),
    });
    // 验证审计日志
    const auditArgs = mockedAuditCreate.mock.calls[0]![0]! as any;
    expect(auditArgs.data).toMatchObject({
      action: 'VIEW',
      targetType: 'EnvVault',
      targetId: 'v1',
      userId: 'u1',
      metadata: { key: 'API_KEY' },
    });
  });
});
