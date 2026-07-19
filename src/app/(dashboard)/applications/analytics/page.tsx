import { AnalyticsClient } from '@/components/features/applications/AnalyticsClient';

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            数据分析
          </h1>
          <p className="text-sm text-muted-foreground">
            投递趋势、状态分布与转化漏斗
          </p>
        </div>
        <AnalyticsClient />
      </div>
    </div>
  );
}
