import { InterviewSchedule } from '@/components/features/interviews/InterviewSchedule';
import { UpcomingInterviews } from '@/components/features/interviews/UpcomingInterviews';

export default async function InterviewsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">面试日程</h1>
          <p className="text-sm text-muted-foreground">查看所有投递的面试安排，按时间倒序</p>
        </div>
        <UpcomingInterviews />
        <InterviewSchedule />
      </div>
    </div>
  );
}
