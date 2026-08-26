import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth/full-config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    snapshot: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { GET, POST } from '@/app/api/snapshots/route';
import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';

const mockedAuth = vi.mocked(auth);
const mockedFindMany = vi.mocked(prisma.snapshot.findMany);
const mockedFindFirst = vi.mocked(prisma.snapshot.findFirst);
const mockedCreate = vi.mocked(prisma.snapshot.create);
const mockedAuditCreate = vi.mocked(prisma.auditLog.create);

const ORIGIN = 'http://localhost:3000';
const HOST = 'localhost:3000';

function makeGetRequest(query = ''): Request {
  return new Request(`http://localhost:3000/api/snapshots${query}`, {
    method: 'GET',
    headers: { host: HOST },
  });
}

function makePostRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/snapshots', {
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

const validSnapshot = {
  name: '登录接口 v1',
  content: '{"code":0,"data":{}}',
  contentType: 'json',
  tags: ['login'],
  project: 'auth',
  isBaseline: false,
};

describe('GET /api/snapshots', () => {
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
      { id: 's1', name: 'snap1', contentLength: 100 },
    ] as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });

  it('project 筛选', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindMany.mockResolvedValueOnce([] as never);

    await GET(makeGetRequest('?project=auth'));

    const args = mockedFindMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ userId: 'u1', project: 'auth' });
  });

  it('contentType 筛选', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindMany.mockResolvedValueOnce([] as never);

    await GET(makeGetRequest('?contentType=json'));

    const args = mockedFindMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ userId: 'u1', contentType: 'json' });
  });

  it('isBaseline=true 筛选', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindMany.mockResolvedValueOnce([] as never);

    await GET(makeGetRequest('?isBaseline=true'));

    const args = mockedFindMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ userId: 'u1', isBaseline: true });
  });

  it('isBaseline=false 筛选', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindMany.mockResolvedValueOnce([] as never);

    await GET(makeGetRequest('?isBaseline=false'));

    const args = mockedFindMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ userId: 'u1', isBaseline: false });
  });

  it('q 关键字搜索 → OR 条件', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindMany.mockResolvedValueOnce([] as never);

    await GET(makeGetRequest('?q=login'));

    const args = mockedFindMany.mock.calls[0][0];
    expect(args.where.OR).toBeDefined();
    expect(args.where.OR).toHaveLength(3); // name / remarks / tags.has
  });
});

describe('POST /api/snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('缺少 Origin 返回 403', async () => {
    const req = new Request('http://localhost:3000/api/snapshots', {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: HOST },
      body: JSON.stringify(validSnapshot),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(mockedAuth).not.toHaveBeenCalled();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await POST(makePostRequest(validSnapshot));
    expect(res.status).toBe(401);
  });

  it('name 为空 → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await POST(makePostRequest({ ...validSnapshot, name: '' }));
    expect(res.status).toBe(400);
  });

  it('content 为空 → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await POST(makePostRequest({ ...validSnapshot, content: '' }));
    expect(res.status).toBe(400);
  });

  it('非法 contentType → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await POST(
      makePostRequest({ ...validSnapshot, contentType: 'yaml' }),
    );
    expect(res.status).toBe(400);
  });

  it('指定 baselineId 但不存在 → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindFirst.mockResolvedValueOnce(null as never);

    const res = await POST(
      makePostRequest({ ...validSnapshot, baselineId: 'non-existent' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('基准快照');
  });

  it('合法创建 → 201 + contentLength 自动计算 + 审计', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedCreate.mockResolvedValueOnce({
      id: 's1',
      name: 'snap1',
      contentLength: validSnapshot.content.length,
    } as never);
    mockedAuditCreate.mockResolvedValueOnce({ id: 'a1' } as never);

    const res = await POST(makePostRequest(validSnapshot));
    expect(res.status).toBe(201);
    // 验证 contentLength 自动计算
    const createArgs = mockedCreate.mock.calls[0][0];
    expect(createArgs.data.contentLength).toBe(validSnapshot.content.length);
    // 验证审计日志
    expect(mockedAuditCreate).toHaveBeenCalledOnce();
    const auditArgs = mockedAuditCreate.mock.calls[0][0];
    expect(auditArgs.data).toMatchObject({
      action: 'CREATE',
      targetType: 'Snapshot',
      userId: 'u1',
    });
  });

  it('tags 超过 10 个 → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await POST(
      makePostRequest({
        ...validSnapshot,
        tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
      }),
    );
    expect(res.status).toBe(400);
  });
});
