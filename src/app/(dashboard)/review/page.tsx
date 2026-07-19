import { ReviewByTag } from '@/components/features/interviews/ReviewByTag';

export default function ReviewPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">错题本</h1>
          <p className="text-sm text-muted-foreground">
            按知识点聚合所有面试题目，重点复盘答得差和一般的题目
          </p>
        </div>
        <ReviewByTag />
      </div>
    </div>
  );
}
