import { ChangelogList } from '@/components/features/changelog/ChangelogList';

export const metadata = {
  title: 'Changelog - 职迹',
};

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Changelog</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            记录版本变更，按类型分类管理变更项，支持截图归档
          </p>
        </div>
        <ChangelogList />
      </div>
    </div>
  );
}
