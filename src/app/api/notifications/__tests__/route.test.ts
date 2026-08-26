import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  NotificationType: {
    INTERVIEW_REMINDER: 'INTERVIEW_REMINDER',
    STATUS_CHANGED: 'STATUS_CHANGED',
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
  InterviewStatus: {
    SCHEDULED: 'SCHEDULED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  },
}));

vi.mock('@/lib/auth/full-config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    interview: {
      findMany: vi.fn(),
    },
  },
}));

// service 里调用了 scanInterviewReminders，要 mock 掉避免真实扫描
vi.mock('@/lib/notifications/service', () => ({
  scanInterviewReminders: vi.fn().mockResolvedValue(0),
}));

import { GET, PATCH } from '@/app/api/notifications/route';
import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';

const mockedAuth = vi.mocked(auth);
const mockedFindMany = vi.mocked(prisma.notification.findMany);
const mockedCount = vi.mocked(prisma.notification.count);
const mockedUpdateMany = vi.mocked(prisma.notification.updateMany);
const mockedDeleteMany = vi.mocked(prisma.notification.deleteMany);

function makeRequest(query = '', headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost:3000/api/notifications${query}`, {
    method: 'GET',
    headers: { host: 'localhost:3000', ...headers },
  });
}

function makePatchRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/notifications', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
    },
    body: JSON.stringify(body),
  });
}

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('已登录返回分页列表 + 未读数', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindMany.mockResolvedValueOnce([
      { id: 'n1', title: 't1', read: false },
    ] as never);
    mockedCount
      .mockResolvedValueOnce(1 as never) // total
      .mockResolvedValueOnce(1 as never); // unreadCount

    const res = await GET(makeRequest('?page=1&pageSize=20'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      items: [{ id: 'n1', title: 't1', read: false }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      unreadCount: 1,
    });
  });

  it('参数错误（page 非正整数）返回 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await GET(makeRequest('?page=0'));
    expect(res.status).toBe(400);
  });

  it('unreadOnly=true 只返回未读', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindMany.mockResolvedValueOnce([] as never);
    mockedCount
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never);

    await GET(makeRequest('?unreadOnly=true'));

    // 验证 findMany 的 where 含 read: false
    const findManyArgs = mockedFindMany.mock.calls[0]![0]! as any;
    expect(findManyArgs.where).toMatchObject({
      userId: 'u1',
      read: false,
    });
  });
});

describe('PATCH /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await PATCH(makePatchRequest({ action: 'mark_all_read' }));
    expect(res.status).toBe(401);
  });

  it('action=mark_all_read 全部已读', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedUpdateMany.mockResolvedValueOnce({ count: 3 } as never);

    const res = await PATCH(makePatchRequest({ action: 'mark_all_read' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(3);
    // 验证只更新未读
    const args = mockedUpdateMany.mock.calls[0]![0]! as any;
    expect(args.where).toMatchObject({ userId: 'u1', read: false });
    expect(args.data).toMatchObject({ read: true });
  });

  it('action=clear_all 清空', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedDeleteMany.mockResolvedValueOnce({ count: 5 } as never);

    const res = await PATCH(makePatchRequest({ action: 'clear_all' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(5);
  });

  it('非法 action 返回 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await PATCH(makePatchRequest({ action: 'invalid' }));
    expect(res.status).toBe(400);
  });

  it('请求体不是 JSON 返回 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const req = new Request('http://localhost:3000/api/notifications', {
      method: 'PATCH',
      headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
      body: 'not-json',
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});
