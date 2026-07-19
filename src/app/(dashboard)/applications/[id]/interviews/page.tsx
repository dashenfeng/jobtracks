import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { InterviewList } from '@/components/features/interviews/InterviewList';

export default async function ApplicationInterviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { id } = await params;

  const application = await prisma.application.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      companyName: true,
      interviews: {
        orderBy: { round: 'asc' },
        include: { questions: true },
      },
    },
  });

  if (!application) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* 面包屑 + 返回 */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 px-2">
            <Link href={`/applications/${id}`}>
              <ArrowLeft className="size-4" />
              返回投递详情
            </Link>
          </Button>
        </div>

        {/* 标题区 */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">面试记录</h1>
          <p className="text-sm text-muted-foreground">
            {application.companyName} 的所有面试场次与面经
          </p>
        </div>

        <InterviewList
          applicationId={application.id}
          companyName={application.companyName}
          interviews={application.interviews}
        />
      </div>
    </div>
  );
}
