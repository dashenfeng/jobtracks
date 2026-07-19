import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto/aes';
import { envVaultImportSchema } from '@/lib/validations/envvault';

/**
 * 批量导入 .env 条目
 *
 * 请求体：{ items: [{ key, value, notes? }] }
 *
 * 行为：
 * - 跳过已存在的 key（按 [userId, key] 唯一约束），不报错
 * - 返回 { created, skipped } 数量与 skipped 的 key 列表
 */
export async function POST(request: Request) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = envVaultImportSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? '参数错误' },
        { status: 400 },
      );
    }

    const userId = session.user.id;
    const items = parsed.data.items;

    // 查询已存在的 key，避免逐条 try/catch
    const existingKeys = (
      await prisma.envVault.findMany({
        where: { userId, key: { in: items.map((i) => i.key) } },
        select: { key: true },
      })
    ).map((r) => r.key);

    const toCreate = items.filter((i) => !existingKeys.includes(i.key));

    if (toCreate.length > 0) {
      // createMany 不返回 id，故分两步：先创建，再查 id 写审计
      await prisma.envVault.createMany({
        data: toCreate.map((i) => ({
          userId,
          key: i.key,
          value: encrypt(i.value),
          notes: i.notes || null,
          tags: [],
        })),
      });

      // 查询刚创建的记录 id（按 key 匹配）写审计日志
      const created = await prisma.envVault.findMany({
        where: { userId, key: { in: toCreate.map((i) => i.key) } },
        select: { id: true, key: true },
      });
      if (created.length > 0) {
        await prisma.auditLog.createMany({
          data: created.map((r) => ({
            userId,
            action: 'CREATE',
            targetType: 'EnvVault',
            targetId: r.id,
            metadata: { key: r.key, source: 'import' },
          })),
        });
      }
    }

    return NextResponse.json({
      created: toCreate.length,
      skipped: existingKeys.length,
      skippedKeys: existingKeys,
    });
  } catch (error) {
    console.error('[envvault import] error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
