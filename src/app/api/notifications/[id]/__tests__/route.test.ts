import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth/full-config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    notification: {
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { PATCH, DELETE } from '@/app/api/notifications/[id]/route';
import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';

const mockedAuth = vi.mocked(auth);
const mockedUpdateMany = vi.mocked(prisma.notification.updateMany);
const mockedDeleteMany = vi.mocked(prisma.notification.deleteMany);

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/notifications/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await PATCH(
      new Request('http://localhost:3000/api/notifications/n1', {
        method: 'PATCH',
      }),
      makeContext('n1'),
    );
    expect(res.status).toBe(401);
  });

  it('通知存在 → 标记已读返回 200', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedUpdateMany.mockResolvedValueOnce({ count: 1 } as never);

    const res = await PATCH(
      new Request('http://localhost:3000/api/notifications/n1', {
        method: 'PATCH',
      }),
      makeContext('n1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(1);
    // 验证 userId 隔离
    const args = mockedUpdateMany.mock.calls[0]![0]! as any;
    expect(args.where).toMatchObject({ id: 'n1', userId: 'u1' });
    expect(args.data).toMatchObject({ read: true });
  });

  it('通知不存在或无权访问 → 返回 404', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedUpdateMany.mockResolvedValueOnce({ count: 0 } as never);

    const res = await PATCH(
      new Request('http://localhost:3000/api/notifications/other-user-notif', {
        method: 'PATCH',
      }),
      makeContext('other-user-notif'),
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/notifications/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await DELETE(
      new Request('http://localhost:3000/api/notifications/n1', {
        method: 'DELETE',
      }),
      makeContext('n1'),
    );
    expect(res.status).toBe(401);
  });

  it('通知存在 → 删除成功', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedDeleteMany.mockResolvedValueOnce({ count: 1 } as never);

    const res = await DELETE(
      new Request('http://localhost:3000/api/notifications/n1', {
        method: 'DELETE',
      }),
      makeContext('n1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(1);
  });

  it('删除别人通知 → count=0 → 404', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedDeleteMany.mockResolvedValueOnce({ count: 0 } as never);

    const res = await DELETE(
      new Request('http://localhost:3000/api/notifications/n2', {
        method: 'DELETE',
      }),
      makeContext('n2'),
    );
    expect(res.status).toBe(404);
  });
});
