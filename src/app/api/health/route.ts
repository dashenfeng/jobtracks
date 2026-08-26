import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

/**
 * 健康检查
 *
 * GET /api/health → { status, timestamp, db, uptime }
 *
 * 用于：Vercel 探活、运维快速判断服务是否正常
 * 不需要鉴权，但会查 DB 连通性
 */
export async function GET() {
  const checks: Record<string, 'ok' | 'fail'> = {};

  // DB 连通性：SELECT 1
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch {
    checks.db = 'fail';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    },
    { status: allOk ? 200 : 503 },
  );
}
