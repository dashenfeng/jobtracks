import { describe, it, expect, beforeEach, vi } from 'vitest';

// mock prisma，避免触碰真实数据库
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { POST } from '@/app/api/auth/register/route';
import { prisma } from '@/lib/db';
import { _resetRateLimitForTest } from '@/lib/auth/rate-limit';

const mockedFindUnique = vi.mocked(prisma.user.findUnique);
const mockedCreate = vi.mocked(prisma.user.create);

const VALID_ORIGIN = 'http://localhost:3000';
const VALID_HOST = 'localhost:3000';

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: VALID_ORIGIN,
      host: VALID_HOST,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  email: 'test@example.com',
  password: 'Pass1234',
  name: 'Test',
};

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    _resetRateLimitForTest();
    vi.clearAllMocks();
  });

  it('缺少 Origin 头返回 403（CSRF）', async () => {
    const reqNoOrigin = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: VALID_HOST },
      body: JSON.stringify(validPayload),
    });
    const res = await POST(reqNoOrigin);
    expect(res.status).toBe(403);
  });

  it('密码少于 8 位返回 400', async () => {
    const res = await POST(makeRequest({ ...validPayload, password: 'Aa1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('8');
  });

  it('密码无字母返回 400', async () => {
    const res = await POST(makeRequest({ ...validPayload, password: '12345678' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('字母');
  });

  it('密码无数字返回 400', async () => {
    const res = await POST(makeRequest({ ...validPayload, password: 'Password' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('数字');
  });

  it('邮箱格式错误返回 400', async () => {
    const res = await POST(makeRequest({ ...validPayload, email: 'not-email' }));
    expect(res.status).toBe(400);
  });

  it('邮箱已注册返回 409', async () => {
    mockedFindUnique.mockResolvedValueOnce({
      id: 'existing',
      email: validPayload.email,
      name: null,
      image: null,
      password: 'hash',
      role: 'USER',
      preferences: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('已被注册');
  });

  it('注册成功返回 200 + userId', async () => {
    mockedFindUnique.mockResolvedValueOnce(null);
    mockedCreate.mockResolvedValueOnce({
      id: 'new-user-id',
      email: validPayload.email,
      name: validPayload.name,
    } as never);
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBe('new-user-id');
    expect(mockedCreate).toHaveBeenCalledOnce();
  });

  it('同一 IP 连续注册 3 次后返回 429', async () => {
    mockedFindUnique.mockResolvedValue(null);
    mockedCreate.mockResolvedValue({ id: 'u', email: 'e' } as never);

    // 用不同邮箱但同一 IP（同一 origin/host）触发限流
    for (let i = 0; i < 3; i++) {
      const res = await POST(
        makeRequest({ ...validPayload, email: `u${i}@example.com` })
      );
      expect(res.status).toBe(200);
    }
    // 第 4 次应被限流
    const res4 = await POST(
      makeRequest({ ...validPayload, email: 'u3@example.com' })
    );
    expect(res4.status).toBe(429);
    const body = await res4.json();
    expect(body.error).toContain('频繁');
  });
});
