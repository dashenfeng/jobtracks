import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/db';

const mockedQueryRaw = vi.mocked(prisma.$queryRaw);

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DB 连通 → 200 + status: ok', async () => {
    mockedQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }] as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe('ok');
    expect(json.checks.db).toBe('ok');
    expect(json.timestamp).toBeDefined();
    expect(json.uptime).toBeDefined();
  });

  it('DB 不通 → 503 + status: degraded', async () => {
    mockedQueryRaw.mockRejectedValueOnce(new Error('Connection refused') as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe('degraded');
    expect(json.checks.db).toBe('fail');
  });
});
