import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { InterviewDetail } from '@/components/features/interviews/InterviewDetail';

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { id } = await params;

  const interview = await prisma.interview.findFirst({
    where: { id, userId: session.user.id },
    include: {
      application: {
        select: { id: true, companyName: true, jobTitle: true },
      },
      questions: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!interview) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* 面包屑 + 返回 */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 px-2">
            <Link href={`/applications/${interview.application.id}/interviews`}>
              <ArrowLeft className="size-4" />
              返回面试记录
            </Link>
          </Button>
        </div>

        <InterviewDetail interview={interview} />
      </div>
    </div>
  );
}
