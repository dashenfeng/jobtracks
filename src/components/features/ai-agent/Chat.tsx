'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Sparkles, Send, Square, Trash2, Loader2, User, Bot, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * AI Agent 聊天界面
 *
 * - useChat 不持久化，刷新即清（不传 id 即为内存态）
 * - 流式响应：AI SDK v7 的 toUIMessageStream 协议
 * - 工具调用：在消息中以内联气泡展示
 */
export function Chat() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const transport = useRef(
    new DefaultChatTransport({
      api: '/api/ai-agent',
    }),
  ).current;

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    transport,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  // 新消息时滚到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    void sendMessage({ text });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 发送，Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleClear() {
    setMessages([]);
  }

  return (
    <Card className="flex h-[calc(100vh-12rem)] flex-col">
      <CardHeader className="flex-row items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <Sparkles className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base">AI 助手</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              只读分析 · 基于你的投递/面试/工具库数据
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={messages.length === 0 || isStreaming}
          className="text-muted-foreground hover:text-foreground"
        >
          <Trash2 className="size-4" />
          清空
        </Button>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </CardContent>

      <div className="border-t border-border p-3 sm:p-4">
        {error && (
          <div className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error.message || '请求失败，请稍后重试'}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="问点啥，比如：我最近 6 个月的投递趋势怎么样？"
            disabled={isStreaming}
            className="min-h-[44px] flex-1 resize-none"
            rows={1}
          />
          {isStreaming ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={stop}
              aria-label="停止生成"
              className="h-[44px] w-[44px]"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              aria-label="发送"
              className="h-[44px] w-[44px]"
            >
              <Send className="size-4" />
            </Button>
          )}
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Enter 发送，Shift+Enter 换行 · 每小时 20 次额度
        </p>
      </div>
    </Card>
  );
}

/** 空状态：展示几个示例问题引导用户 */
function EmptyState() {
  const examples = [
    '我现在的投递状态分布是怎么样的？',
    '最近 6 个月我的投递趋势如何？',
    '我有多少场面试还没进行？',
    '我答得最差的题目有哪些？',
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
        <Sparkles className="size-6" />
      </div>
      <div>
        <p className="font-medium text-foreground">问点什么吧</p>
        <p className="mt-1 text-sm text-muted-foreground">
          我能查你的投递、面试、错题、快照、Changelog 数据
        </p>
      </div>
      <div className="mt-2 grid w-full max-w-md gap-2">
        {examples.map((q) => (
          <div
            key={q}
            className="rounded-md border border-border bg-muted/30 px-3 py-2 text-left text-sm text-muted-foreground"
          >
            {q}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 消息气泡：根据 role 渲染用户/AI，AI 消息里可能包含工具调用 */
function MessageBubble({ message }: { message: ReturnType<typeof useChat>['messages'][number] }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isUser
            ? 'bg-muted text-muted-foreground'
            : 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white',
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div className={cn('flex max-w-[85%] flex-col gap-2', isUser && 'items-end')}>
        {/* 消息各 part：text / tool-* */}
        {message.parts.map((part, i) => {
          const key = `${message.id}-${i}`;
          if (part.type === 'text') {
            return (
              <div
                key={key}
                className={cn(
                  'rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words',
                  isUser
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground',
                )}
              >
                {part.text}
              </div>
            );
          }
          if (part.type.startsWith('tool-')) {
            return <ToolInvocation key={key} part={part} />;
          }
          // reasoning 等其他 part 暂不渲染
          return null;
        })}
      </div>
    </div>
  );
}

/** 工具调用气泡：紧凑展示工具名 + 状态 */
function ToolInvocation({
  part,
}: {
  part: {
    type: string;
    toolCallId?: string;
    toolName?: string;
    state?: string;
    input?: unknown;
    output?: unknown;
  };
}) {
  const toolLabel = TOOL_LABELS[part.toolName ?? ''] ?? part.toolName ?? '工具';
  const isRunning = part.state === 'input-streaming' || part.state === 'input-available';
  const isDone = part.state === 'output-available';

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
      <Wrench className="size-3" />
      <span className="font-medium text-foreground">{toolLabel}</span>
      {isRunning && <Loader2 className="size-3 animate-spin" />}
      {isDone && <span className="text-emerald-600 dark:text-emerald-400">已查询</span>}
    </div>
  );
}

/** 工具名 → 中文标签（仅用于展示） */
const TOOL_LABELS: Record<string, string> = {
  list_applications: '查询投递列表',
  get_application_detail: '查询投递详情',
  get_application_stats: '查询投递统计',
  get_application_analytics: '查询数据分析',
  list_interviews: '查询面试列表',
  get_interview_detail: '查询面试详情',
  list_review_questions: '查询错题本',
  list_snapshots: '查询快照列表',
  list_changelogs: '查询 Changelog',
};
