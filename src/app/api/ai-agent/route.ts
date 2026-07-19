import { NextResponse } from 'next/server';
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  isStepCount,
  type UIMessage,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { rateLimit, getClientIp } from '@/lib/auth/rate-limit';
import { agentTools } from '@/lib/ai/tools';
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt';

// 强制 Node.js Runtime（DeepSeek SDK + Prisma 都不能在 Edge 跑）
export const runtime = 'nodejs';
// 单次请求最多 60 秒（流式 + 工具调用）
export const maxDuration = 60;

// 限流：每用户 20 次/小时
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * AI Agent 对话接口
 *
 * POST /api/ai-agent
 *
 * 安全：
 * - 登录校验（auth）
 * - CSRF（Origin 头校验）
 * - 限流（每用户 20 次/小时，按 userId 维度）
 * - 只读工具集（不能修改数据）
 *
 * 流式响应使用 AI SDK v7 的 stateless helpers：
 *   toUIMessageStream + createUIMessageStreamResponse
 */
export async function POST(request: Request) {
  // 1. CSRF
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  // 2. 鉴权
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const userId = session.user.id;

  // 3. 限流（按 userId 维度，避免 IP 共享时误伤）
  const rateLimitKey = `ai-agent:${userId}`;
  if (!rateLimit(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    const ip = getClientIp(request);
    return NextResponse.json(
      {
        error: '请求过于频繁，请稍后再试',
        limit: RATE_LIMIT_MAX,
        windowMs: RATE_LIMIT_WINDOW_MS,
        ip,
      },
      { status: 429 },
    );
  }

  // 4. 解析请求体
  let messages: UIMessage[];
  try {
    const body = await request.json();
    messages = body.messages;
    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages 字段必须是数组' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  // 5. 配置 DeepSeek（兼容 OpenAI 协议）
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  if (!apiKey) {
    return NextResponse.json(
      { error: 'DeepSeek API Key 未配置（DEEPSEEK_API_KEY）' },
      { status: 500 },
    );
  }
  const deepseek = createOpenAI({ apiKey, baseURL });

  // 6. 流式调用
  // DeepSeek 兼容 OpenAI 的 Chat Completions API（/v1/chat/completions），
  // 但不支持 Responses API（/v1/responses）。@ai-sdk/openai v4 默认走 Responses API，
  // 所以必须用 `.chat()` 显式指定 Chat Completions，否则会 404。
  const result = streamText({
    model: deepseek.chat('deepseek-chat'),
    instructions: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: agentTools,
    // 工具循环：最多 5 步，让 Agent 能调多个工具再总结
    stopWhen: isStepCount(5),
    toolsContext: {
      list_applications: { userId },
      get_application_detail: { userId },
      get_application_stats: { userId },
      get_application_analytics: { userId },
      list_interviews: { userId },
      get_interview_detail: { userId },
      list_review_questions: { userId },
      list_snapshots: { userId },
      list_changelogs: { userId },
    },
  });

  // 7. 返回 UI 消息流
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
