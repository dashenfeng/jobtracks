import { SnapshotList } from '@/components/features/snapshots/SnapshotList';

export const metadata = {
  title: '快照对比 - 职迹',
};

export default function SnapshotsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">快照对比</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            保存 JSON / XML / 文本快照，勾选两个快照进行版本差异对比
          </p>
        </div>
        <SnapshotList />
      </div>
    </div>
  );
}
