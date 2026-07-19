import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChangelogFormDialog } from '@/components/features/changelog/ChangelogFormDialog';
import { ChangelogDetailActions } from '@/components/features/changelog/ChangelogDetailActions';
import { CHANGE_TYPE_MAP } from '@/lib/constants/changelog';
import type { ChangeType } from '@prisma/client';
import { formatDateTime, formatDate } from '@/lib/utils';

export const metadata = {
  title: 'Changelog 详情 - 职迹',
};

export default async function ChangelogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { id } = await params;
  const changelog = await prisma.changelog.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      version: true,
      releasedAt: true,
      screenshots: true,
      createdAt: true,
      updatedAt: true,
      changes: {
        orderBy: { id: 'asc' },
        select: { id: true, type: true, description: true },
      },
    },
  });

  if (!changelog) notFound();

  // 按类型分组
  const grouped = changelog.changes.reduce<
    Record<ChangeType, typeof changelog.changes>
  >(
    (acc, c) => {
      (acc[c.type] ||= []).push(c);
      return acc;
    },
    { NEW: [], FIX: [], IMPROVED: [], BREAKING: [] },
  );

  const typeOrder: ChangeType[] = ['NEW', 'IMPROVED', 'FIX', 'BREAKING'];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* 返回 */}
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/tools/changelog">
              <ArrowLeft className="size-4" />
              返回 Changelog 列表
            </Link>
          </Button>
        </div>

        {/* 标题区 */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {changelog.version}
            </h1>
            <p className="text-sm text-muted-foreground">
              发布于 {formatDate(changelog.releasedAt)} ·{' '}
              {changelog.changes.length} 条变更
            </p>
          </div>
          <ChangelogFormDialog
            mode="edit"
            changelog={{
              id: changelog.id,
              version: changelog.version,
              releasedAt: changelog.releasedAt.toISOString(),
              screenshots: changelog.screenshots,
              changes: changelog.changes,
            }}
            trigger={<Button variant="outline" size="sm">编辑</Button>}
          />
        </div>

        {/* 元数据 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight">
              元数据
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">版本号</span>
              <span className="font-mono text-foreground">{changelog.version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">发布日期</span>
              <span className="text-foreground">{formatDate(changelog.releasedAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">创建时间</span>
              <span className="text-foreground">
                {formatDateTime(changelog.createdAt)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">最后更新</span>
              <span className="text-foreground">
                {formatDateTime(changelog.updatedAt)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 变更项（按类型分组） */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight">
              变更内容
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {typeOrder.map((type) => {
              const list = grouped[type];
              if (!list || list.length === 0) return null;
              const meta = CHANGE_TYPE_MAP[type];
              return (
                <div key={type} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{meta.icon}</span>
                    <h3 className="text-sm font-semibold text-foreground">
                      {meta.label}
                    </h3>
                    <Badge variant={meta.badge}>{list.length}</Badge>
                  </div>
                  <ul className="space-y-2 pl-6">
                    {list.map((c) => (
                      <li
                        key={c.id}
                        className="text-sm text-foreground leading-relaxed"
                      >
                        <span className="text-muted-foreground mr-2">·</span>
                        {c.description}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {changelog.changes.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无变更记录</p>
            )}
          </CardContent>
        </Card>

        {/* 截图 */}
        {changelog.screenshots.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold tracking-tight">
                截图归档
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {changelog.screenshots.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block overflow-hidden rounded-lg border border-border bg-muted/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`截图 ${idx + 1}`}
                      className="h-40 w-full object-cover transition-opacity group-hover:opacity-80"
                      loading="lazy"
                    />
                    <span className="absolute bottom-2 right-2 rounded-md bg-background/80 px-2 py-0.5 text-xs text-foreground">
                      #{idx + 1}
                    </span>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* 危险操作 */}
        <ChangelogDetailActions id={changelog.id} version={changelog.version} />
      </div>
    </div>
  );
}
