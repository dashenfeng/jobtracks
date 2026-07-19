import { z } from 'zod';
import { AuditAction } from '@prisma/client';

import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';
import { toCsvWithBom } from '@/lib/csv';
import { ACTION_LABELS, TARGET_TYPE_LABELS } from '@/lib/constants/audit-log';

/**
 * 审计日志 CSV 导出
 *
 * GET /api/audit-logs/export?action=&targetType=&from=&to=
 *
 * - 返回 text/csv 文件流（带 UTF-8 BOM，Excel 兼容）
 * - 最多导出 10000 条（防滥用）
 * - 不记审计日志（避免递归）
 */

const MAX_EXPORT = 10000;

const querySchema = z.object({
  action: z.nativeEnum(AuditAction).optional(),
  targetType: z.string().trim().min(1).optional(),
  from: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'from 日期无效' })
    .optional(),
  to: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'to 日期无效' })
    .optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    action: url.searchParams.get('action') ?? undefined,
    targetType: url.searchParams.get('targetType') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  });

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: '参数错误' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { action, targetType, from, to } = parsed.data;

  const where = {
    userId: session.user.id,
    ...(action ? { action } : {}),
    ...(targetType ? { targetType } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const items = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: MAX_EXPORT,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
    },
  });

  // 构造 CSV 行
  const header = ['时间', '动作', '目标类型', '目标ID', '键名/版本', '详情'];
  const rows: (string | number)[][] = items.map((log) => {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    // 键名/版本列：根据 targetType 取不同的标识字段
    const label =
      (typeof meta.key === 'string' && meta.key) ||
      (typeof meta.name === 'string' && meta.name) ||
      (typeof meta.version === 'string' && meta.version) ||
      (log.targetId === 'all' ? '（批量）' : '');

    // 详情列：metadata 的 JSON 字符串（排除已展示的标识字段）
    const detail = JSON.stringify(meta);
    return [
      log.createdAt.toISOString(),
      ACTION_LABELS[log.action] ?? log.action,
      TARGET_TYPE_LABELS[log.targetType] ?? log.targetType,
      log.targetId,
      label,
      detail,
    ];
  });

  const csv = toCsvWithBom([header, ...rows]);

  // 时间戳文件名
  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
  const filename = `audit-logs-${ts}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': Buffer.byteLength(csv, 'utf-8').toString(),
    },
  });
}
