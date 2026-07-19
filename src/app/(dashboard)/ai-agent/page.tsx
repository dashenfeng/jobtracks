import { Chat } from '@/components/features/ai-agent/Chat';

export const metadata = {
  title: 'AI 助手 - 职迹',
};

export default function AiAgentPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI 助手</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            用自然语言查询你的投递、面试、错题、快照和 Changelog 数据。只读分析，不会修改任何记录。
          </p>
        </div>
        <Chat />
      </div>
    </div>
  );
}
