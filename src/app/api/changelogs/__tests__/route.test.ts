import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth/full-config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    changelog: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { GET, POST } from '@/app/api/changelogs/route';
import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';

const mockedAuth = vi.mocked(auth);
const mockedFindMany = vi.mocked(prisma.changelog.findMany);
const mockedFindFirst = vi.mocked(prisma.changelog.findFirst);
const mockedCreate = vi.mocked(prisma.changelog.create);
const mockedAuditCreate = vi.mocked(prisma.auditLog.create);

const ORIGIN = 'http://localhost:3000';
const HOST = 'localhost:3000';

function makeGetRequest(query = ''): Request {
  return new Request(`http://localhost:3000/api/changelogs${query}`, {
    method: 'GET',
    headers: { host: HOST },
  });
}

function makePostRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/changelogs', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      host: HOST,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validChangelog = {
  version: 'v1.0.0',
  releasedAt: '2026-08-04',
  screenshots: [],
  changes: [
    { type: 'NEW', description: '新增通知系统' },
    { type: 'FIX', description: '修复薪资显示' },
  ],
};

describe('GET /api/changelogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it('已登录返回列表', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindMany.mockResolvedValueOnce([
      { id: 'c1', version: 'v1.0.0', _count: { changes: 2 } },
    ] as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: 'c1', version: 'v1.0.0' });
  });

  it('按 type 筛选 → where 含 changes.some.type', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindMany.mockResolvedValueOnce([] as never);

    await GET(makeGetRequest('?type=NEW'));

    const args = mockedFindMany.mock.calls[0]![0]! as any;
    expect(args.where).toMatchObject({
      userId: 'u1',
      changes: { some: { type: 'NEW' } },
    });
  });

  it('按 q 关键字搜索', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindMany.mockResolvedValueOnce([] as never);

    await GET(makeGetRequest('?q=notification'));

    const args = mockedFindMany.mock.calls[0]![0]! as any;
    expect(args.where.OR).toBeDefined();
    expect(args.where.OR).toHaveLength(2);
  });
});

describe('POST /api/changelogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('缺少 Origin 返回 403', async () => {
    const req = new Request('http://localhost:3000/api/changelogs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: HOST },
      body: JSON.stringify(validChangelog),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(mockedAuth).not.toHaveBeenCalled();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await POST(makePostRequest(validChangelog));
    expect(res.status).toBe(401);
  });

  it('version 为空 → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await POST(makePostRequest({ ...validChangelog, version: '' }));
    expect(res.status).toBe(400);
  });

  it('changes 为空数组 → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await POST(makePostRequest({ ...validChangelog, changes: [] }));
    expect(res.status).toBe(400);
  });

  it('非法 change.type → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await POST(
      makePostRequest({
        ...validChangelog,
        changes: [{ type: 'INVALID', description: 'x' }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it('版本号已存在 → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindFirst.mockResolvedValueOnce({ id: 'existing' } as never);

    const res = await POST(makePostRequest(validChangelog));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('已存在');
  });

  it('合法创建 → 201 + 写审计日志', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindFirst.mockResolvedValueOnce(null as never);
    mockedCreate.mockResolvedValueOnce({
      id: 'c1',
      version: 'v1.0.0',
      changes: [
        { id: 'ch1', type: 'NEW', description: '新增通知系统' },
        { id: 'ch2', type: 'FIX', description: '修复薪资显示' },
      ],
    } as never);
    mockedAuditCreate.mockResolvedValueOnce({ id: 'a1' } as never);

    const res = await POST(makePostRequest(validChangelog));
    expect(res.status).toBe(201);
    // 验证写审计日志
    expect(mockedAuditCreate).toHaveBeenCalledOnce();
    const auditArgs = mockedAuditCreate.mock.calls[0]![0]! as any;
    expect(auditArgs.data).toMatchObject({
      action: 'CREATE',
      targetType: 'Changelog',
      userId: 'u1',
    });
  });

  it('截图 URL 不合法 → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await POST(
      makePostRequest({
        ...validChangelog,
        screenshots: ['not-a-url'],
      }),
    );
    expect(res.status).toBe(400);
  });
});
