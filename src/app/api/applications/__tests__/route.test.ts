import { describe, it, expect, beforeEach, vi } from 'vitest';

// mock @prisma/client 的 enum，避免触发真实 Prisma Client 加载（vitest 下解析 .prisma/client/default 失败）
vi.mock('@prisma/client', () => ({
  Channel: {
    BOSS: 'BOSS',
    NIUKER: 'NIUKER',
    OFFICIAL: 'OFFICIAL',
    REFERRAL: 'REFERRAL',
    OTHER: 'OTHER',
  },
  Status: {
    PENDING: 'PENDING',
    APPLIED: 'APPLIED',
    WRITTEN: 'WRITTEN',
    INTERVIEW_1: 'INTERVIEW_1',
    INTERVIEW_2: 'INTERVIEW_2',
    INTERVIEW_3: 'INTERVIEW_3',
    HR: 'HR',
    OFFER: 'OFFER',
    REJECTED: 'REJECTED',
    ABANDONED: 'ABANDONED',
  },
}));

// mock auth 与 prisma
vi.mock('@/lib/auth/full-config', () => ({
  auth: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  prisma: {
    application: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { GET, POST } from '@/app/api/applications/route';
import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';

const mockedAuth = vi.mocked(auth);
const mockedFindMany = vi.mocked(prisma.application.findMany);
const mockedCount = vi.mocked(prisma.application.count);
const mockedCreate = vi.mocked(prisma.application.create);

const VALID_ORIGIN = 'http://localhost:3000';
const VALID_HOST = 'localhost:3000';

function makeJsonRequest(
  method: 'GET' | 'POST',
  body?: unknown,
  headers: Record<string, string> = {}
): Request {
  const url = 'http://localhost:3000/api/applications';
  return new Request(method === 'GET' ? url : url, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: VALID_ORIGIN,
      host: VALID_HOST,
      ...headers,
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

const validApplication = {
  companyName: 'ACME',
  jobTitle: '前端工程师',
  channel: 'BOSS',
  status: 'PENDING',
};

describe('GET /api/applications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await GET(makeJsonRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('已登录返回分页列表', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindMany.mockResolvedValueOnce([] as never);
    mockedCount.mockResolvedValueOnce(0 as never);
    const res = await GET(makeJsonRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });
});

describe('POST /api/applications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('缺少 Origin 返回 403（CSRF 优先于 auth）', async () => {
    const req = new Request('http://localhost:3000/api/applications', {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: VALID_HOST },
      body: JSON.stringify(validApplication),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    // auth 不应被调用
    expect(mockedAuth).not.toHaveBeenCalled();
  });

  it('同源但未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await POST(makeJsonRequest('POST', validApplication));
    expect(res.status).toBe(401);
  });

  it('已登录但 body 缺少必填字段返回 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await POST(makeJsonRequest('POST', { companyName: 'ACME' }));
    expect(res.status).toBe(400);
  });

  it('已登录 + 有效 body 返回 201', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedCreate.mockResolvedValueOnce({ id: 'app1', ...validApplication } as never);
    const res = await POST(makeJsonRequest('POST', validApplication));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('app1');
    expect(mockedCreate).toHaveBeenCalledOnce();
  });
});
