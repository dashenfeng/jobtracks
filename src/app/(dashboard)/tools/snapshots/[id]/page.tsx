import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Star } from 'lucide-react';

import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SnapshotFormDialog } from '@/components/features/snapshots/SnapshotFormDialog';
import { CopyButton } from '@/components/features/snapshots/CopyButton';
import { formatDateTime } from '@/lib/utils';

export const metadata = {
  title: '快照详情 - 职迹',
};

export default async function SnapshotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { id } = await params;
  const snapshot = await prisma.snapshot.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!snapshot) notFound();

  // 尝试格式化 JSON
  let formattedContent = snapshot.content;
  let isJson = false;
  if (snapshot.contentType === 'json') {
    try {
      formattedContent = JSON.stringify(JSON.parse(snapshot.content), null, 2);
      isJson = true;
    } catch {
      // 非合法 JSON，按原文显示
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* 面包屑式返回 */}
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/tools/snapshots">
              <ArrowLeft className="size-4" />
              返回快照列表
            </Link>
          </Button>
        </div>

        {/* 标题区 */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {snapshot.isBaseline && (
                <Star className="size-5 fill-amber-400 text-amber-400" />
              )}
              <h1 className="text-2xl font-semibold tracking-tight">
                {snapshot.name}
              </h1>
            </div>
            {snapshot.remarks && (
              <p className="text-sm text-muted-foreground">{snapshot.remarks}</p>
            )}
          </div>
          <SnapshotFormDialog
            mode="edit"
            snapshot={snapshot}
            trigger={<Button variant="outline" size="sm">编辑</Button>}
          />
        </div>

        {/* 元数据卡片 */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg font-semibold tracking-tight">
                元数据
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">内容类型</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {snapshot.contentType.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">项目</span>
                <span className="text-foreground">{snapshot.project || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">字符数</span>
                <span className="text-foreground">
                  {snapshot.contentLength.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">基准快照</span>
                <span className="text-foreground">
                  {snapshot.isBaseline ? '是' : '否'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">创建时间</span>
                <span className="text-foreground">
                  {formatDateTime(snapshot.createdAt)}
                </span>
              </div>
              {snapshot.tags.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-muted-foreground">标签</span>
                  <div className="flex flex-wrap gap-1.5">
                    {snapshot.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 内容预览 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg font-semibold tracking-tight">
                <span>内容</span>
                <CopyButton text={snapshot.content} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre
                className={`max-h-[600px] overflow-auto rounded-md bg-muted/30 p-4 text-xs ${
                  isJson ? 'font-mono' : 'font-mono whitespace-pre-wrap'
                }`}
              >
                {isJson ? formattedContent : snapshot.content}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
