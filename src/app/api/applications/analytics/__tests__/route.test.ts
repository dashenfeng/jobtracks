import { describe, it, expect, beforeEach, vi } from 'vitest';

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

vi.mock('@/lib/auth/full-config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    application: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/applications/analytics/route';
import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';

const mockedAuth = vi.mocked(auth);
const mockedFindMany = vi.mocked(prisma.application.findMany);

function makeRequest(): Request {
  return new Request('http://localhost:3000/api/applications/analytics', {
    method: 'GET',
    headers: { host: 'localhost:3000' },
  });
}

describe('GET /api/applications/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('无投递数据 → 全 0 指标 + 空分布', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindMany.mockResolvedValueOnce([] as never);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics).toMatchObject({
      total: 0,
      interviewCount: 0,
      offerCount: 0,
      activeCount: 0,
      interviewRate: 0,
      offerRate: 0,
    });
    expect(body.statusDistribution).toEqual([]);
    expect(body.channelDistribution).toEqual([]);
    expect(body.funnel).toHaveLength(4);
    expect(body.funnel).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: '已投递', count: 0 }),
        expect.objectContaining({ stage: 'Offer', count: 0 }),
      ]),
    );
    // 6 个月趋势
    expect(body.trend).toHaveLength(6);
  });

  it('有投递数据 → 正确聚合分布/漏斗/指标', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const now = new Date();
    const apps = [
      // 已投递且拿到 offer
      {
        status: 'OFFER',
        channel: 'BOSS',
        createdAt: now,
      },
      // 面试中
      {
        status: 'INTERVIEW_1',
        channel: 'BOSS',
        createdAt: now,
      },
      // 已投递但被拒
      {
        status: 'REJECTED',
        channel: 'NIUKER',
        createdAt: now,
      },
      // 待投递
      {
        status: 'PENDING',
        channel: 'OFFICIAL',
        createdAt: now,
      },
    ];
    mockedFindMany.mockResolvedValueOnce(apps as never);

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.metrics.total).toBe(4);
    expect(body.metrics.interviewCount).toBe(2); // INTERVIEW_1 + OFFER
    expect(body.metrics.offerCount).toBe(1);
    // activeCount = PENDING/APPLIED/WRITTEN/INTERVIEW_1/2/3/HR（不含 OFFER/REJECTED/ABANDONED）
    // = INTERVIEW_1 + PENDING = 2
    expect(body.metrics.activeCount).toBe(2);
    // funnel：每层是上层子集的累计数
    // 数据：OFFER + INTERVIEW_1 + REJECTED + PENDING
    // 已投递 = APPLIED+WRITTEN+INTERVIEW_1+...+OFFER = INTERVIEW_1 + OFFER = 2
    // 笔试 = WRITTEN+INTERVIEW_1+...+OFFER = INTERVIEW_1 + OFFER = 2
    // 面试 = INTERVIEW_1+...+OFFER = INTERVIEW_1 + OFFER = 2
    // Offer = OFFER = 1
    expect(body.funnel).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: '已投递', count: 2 }),
        expect.objectContaining({ stage: '笔试', count: 2 }),
        expect.objectContaining({ stage: '面试', count: 2 }),
        expect.objectContaining({ stage: 'Offer', count: 1 }),
      ]),
    );
    // statusDistribution 至少含 OFFER / INTERVIEW_1 / REJECTED / PENDING
    const statusKeys = body.statusDistribution.map((s: { key: string }) => s.key);
    expect(statusKeys).toEqual(
      expect.arrayContaining(['OFFER', 'INTERVIEW_1', 'REJECTED', 'PENDING']),
    );
    // channelDistribution
    const channelKeys = body.channelDistribution.map((c: { key: string }) => c.key);
    expect(channelKeys).toEqual(
      expect.arrayContaining(['BOSS', 'NIUKER', 'OFFICIAL']),
    );
  });

  it('面试率 = interviewCount / total', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedFindMany.mockResolvedValueOnce([
      { status: 'INTERVIEW_1', channel: 'BOSS', createdAt: new Date() },
      { status: 'PENDING', channel: 'BOSS', createdAt: new Date() },
    ] as never);

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.metrics.total).toBe(2);
    expect(body.metrics.interviewCount).toBe(1);
    expect(body.metrics.interviewRate).toBeCloseTo(0.5);
  });
});
