import { JsonToolsClient } from '@/components/features/json-tools/JsonToolsClient';

export default function JsonToolsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">JSON 工具</h1>
          <p className="text-sm text-muted-foreground">
            格式化 / 压缩 · 命名风格转换 · JSON 对比 · JSONPath 提取（纯前端，数据不离开浏览器）
          </p>
        </div>
        <JsonToolsClient />
      </div>
    </div>
  );
}
