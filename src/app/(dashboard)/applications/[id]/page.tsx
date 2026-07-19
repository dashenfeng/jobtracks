import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Pencil, MapPin, Briefcase, Wallet, Calendar } from 'lucide-react';

import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';
import { mergePreferences } from '@/lib/types/user';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatusSwitcher } from '@/components/features/applications/StatusSwitcher';
import { SalaryToggle } from '@/components/features/applications/SalaryToggle';
import { ApplicationFormDialog } from '@/components/features/applications/ApplicationFormDialog';
import { DeleteApplicationButton } from '@/components/features/applications/DeleteApplicationButton';
import { InterviewList } from '@/components/features/interviews/InterviewList';
import { CHANNEL_MAP } from '@/lib/constants/applications';
import { formatDateTime } from '@/lib/utils';

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { id } = await params;
  const [application, userRow] = await Promise.all([
    prisma.application.findFirst({
      where: { id, userId: session.user.id },
      include: {
        interviews: {
          orderBy: { round: 'asc' },
          include: { questions: true },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    }),
  ]);

  if (!application) notFound();

  const preferences = mergePreferences(userRow?.preferences);
  const infoItems = [
    { label: '渠道', value: CHANNEL_MAP[application.channel], icon: Briefcase },
    { label: '城市', value: application.city || '-', icon: MapPin },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        {/* 面包屑 + 返回 */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 px-2">
            <Link href="/applications">
              <ArrowLeft className="size-4" />
              投递管理
            </Link>
          </Button>
        </div>

        {/* 标题区 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {application.companyName}
              </h1>
              <StatusSwitcher id={application.id} status={application.status} />
            </div>
            <p className="text-base text-muted-foreground">{application.jobTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <ApplicationFormDialog
              mode="edit"
              application={application}
              trigger={
                <Button variant="outline">
                  <Pencil className="size-4" />
                  编辑
                </Button>
              }
            />
            <DeleteApplicationButton id={application.id} />
          </div>
        </div>

        {/* 信息卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {infoItems.map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <item.icon className="size-3.5" />
                    {item.label}
                  </div>
                  <div className="text-sm font-medium text-foreground">{item.value}</div>
                </div>
              ))}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="size-3.5" />
                  薪资范围
                </div>
                <SalaryToggle
                  value={application.salaryRange}
                  maskByDefault={preferences.salaryMaskEnabled ?? true}
                />
              </div>
            </div>
            <Separator className="my-6" />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" />
                  创建时间
                </div>
                <div className="text-sm font-medium text-foreground">
                  {formatDateTime(application.createdAt)}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" />
                  更新时间
                </div>
                <div className="text-sm font-medium text-foreground">
                  {formatDateTime(application.updatedAt)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 职位链接 */}
        {application.jobUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">职位链接</CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={application.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
              >
                {application.jobUrl}
                <ExternalLink className="size-3.5" />
              </a>
            </CardContent>
          </Card>
        )}

        {/* 备注 */}
        {application.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">备注</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {application.notes}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 面试记录（直接嵌入，无需跳转子页即可新增/编辑/删除） */}
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">面试记录</h2>
            <p className="text-sm text-muted-foreground">
              为 {application.companyName} 添加面试场次与面经题目
            </p>
          </div>
          <InterviewList
            applicationId={application.id}
            companyName={application.companyName}
            interviews={application.interviews}
          />
        </div>
      </div>
    </div>
  );
}
