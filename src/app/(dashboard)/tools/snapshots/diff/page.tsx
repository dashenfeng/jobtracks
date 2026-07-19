import { Suspense } from 'react';
import { SnapshotDiffClient } from '@/components/features/snapshots/SnapshotDiffClient';

export const metadata = {
  title: '快照对比 - 职迹',
};

export default function SnapshotDiffPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">快照对比</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            对比两个快照的内容差异，JSON 类型自动走深度 diff，其他类型走行级 diff
          </p>
        </div>
        <Suspense fallback={null}>
          <SnapshotDiffClient />
        </Suspense>
      </div>
    </div>
  );
}
