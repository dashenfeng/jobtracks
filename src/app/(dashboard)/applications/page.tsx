import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';
import { mergePreferences } from '@/lib/types/user';
import { CreateApplicationButton } from '@/components/features/applications/CreateApplicationButton';
import { ApplicationList } from '@/components/features/applications/ApplicationList';
import { UpcomingInterviews } from '@/components/features/interviews/UpcomingInterviews';

export default async function ApplicationsPage() {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { preferences: true },
      })
    : null;
  const preferences = mergePreferences(user?.preferences);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">投递管理</h1>
            <p className="text-sm text-muted-foreground">追踪你的求职进度，记录每一次面试经验</p>
          </div>
          <CreateApplicationButton />
        </div>
        <UpcomingInterviews />
        <ApplicationList salaryMaskByDefault={preferences.salaryMaskEnabled ?? true} />
      </div>
    </div>
  );
}
