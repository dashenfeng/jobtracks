import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { applicationSchema, applicationQuerySchema } from '@/lib/validations/application';

/** 获取投递列表（分页 + 筛选 + 关键词搜索） */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = applicationQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );

  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const { page, pageSize, status, channel, keyword } = parsed.data;

  const where = {
    userId: session.user.id,
    ...(status ? { status } : {}),
    ...(channel ? { channel } : {}),
    ...(keyword
      ? {
          OR: [
            { companyName: { contains: keyword, mode: 'insensitive' as const } },
            { jobTitle: { contains: keyword, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.application.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

/** 新增投递 */
export async function POST(request: Request) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = applicationSchema.safeParse(body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json({ error: firstError?.message ?? '参数错误' }, { status: 400 });
  }

  const data = parsed.data;
  const application = await prisma.application.create({
    data: {
      ...data,
      jobUrl: data.jobUrl || null,
      city: data.city || null,
      salaryRange: data.salaryRange || null,
      notes: data.notes || null,
      userId: session.user.id,
    },
  });

  return NextResponse.json(application, { status: 201 });
}
