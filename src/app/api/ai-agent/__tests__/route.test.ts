import { describe, it, expect, beforeEach, vi } from 'vitest';

// mock AI SDK 的所有依赖
vi.mock('ai', () => ({
  streamText: vi.fn(),
  convertToModelMessages: vi.fn().mockResolvedValue([]),
  createUIMessageStreamResponse: vi.fn().mockReturnValue(new Response('stream', { status: 200 })),
  toUIMessageStream: vi.fn().mockReturnValue({}),
  isStepCount: vi.fn().mockReturnValue({}),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockReturnValue({
    chat: vi.fn().mockReturnValue({ modelId: 'mock' }),
  }),
}));

vi.mock('@/lib/auth/full-config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/auth/csrf', () => ({
  checkCsrf: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/auth/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue(true),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  _resetRateLimitForTest: vi.fn(),
}));

vi.mock('@/lib/ai/tools', () => ({
  agentTools: {},
}));

vi.mock('@/lib/ai/system-prompt', () => ({
  SYSTEM_PROMPT: 'You are a helpful assistant.',
}));

import { POST } from '@/app/api/ai-agent/route';
import { auth } from '@/lib/auth/full-config';
import { checkCsrf } from '@/lib/auth/csrf';
import { rateLimit, _resetRateLimitForTest } from '@/lib/auth/rate-limit';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { NextResponse } from 'next/server';

const mockedAuth = vi.mocked(auth);
const mockedCheckCsrf = vi.mocked(checkCsrf);
const mockedRateLimit = vi.mocked(rateLimit);
const mockedStreamText = vi.mocked(streamText);

const ORIGIN = 'http://localhost:3000';
const HOST = 'localhost:3000';

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/ai-agent', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      host: HOST,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  messages: [
    {
      id: 'm1',
      role: 'user',
      parts: [{ type: 'text', text: '列出我的投递' }],
    },
  ],
};

describe('POST /api/ai-agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimitForTest();
    mockedCheckCsrf.mockReturnValue(null);
    mockedRateLimit.mockReturnValue(true);
    // 给 DEEPSEEK_API_KEY 占位值，避免 500
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
  });

  it('CSRF 失败 → 403', async () => {
    mockedCheckCsrf.mockReturnValueOnce(
      new NextResponse('Forbidden', { status: 403 }) as never,
    );
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
    expect(mockedAuth).not.toHaveBeenCalled();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it('触发限流 → 429', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedRateLimit.mockReturnValueOnce(false);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.limit).toBe(20);
  });

  it('messages 不是数组 → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await POST(makeRequest({ messages: 'not-array' }));
    expect(res.status).toBe(400);
  });

  it('请求体不是 JSON → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const req = new Request('http://localhost:3000/api/ai-agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ORIGIN,
        host: HOST,
      },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('DEEPSEEK_API_KEY 未配置 → 500', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    delete process.env.DEEPSEEK_API_KEY;

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('DEEPSEEK_API_KEY');
  });

  it('合法请求 → 调用 streamText 并返回流式响应', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedStreamText.mockReturnValueOnce({
      stream: { [Symbol.asyncIterator]: async function* () {} },
    } as never);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(mockedStreamText).toHaveBeenCalledOnce();
    // 验证 streamText 调用参数
    const callArgs = mockedStreamText.mock.calls[0]![0]! as any;
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.stopWhen).toBeDefined();
    expect(callArgs.toolsContext).toMatchObject({
      list_applications: { userId: 'u1' },
      get_application_detail: { userId: 'u1' },
    });
    // 验证模型名为 deepseek-v4-flash
    expect(callArgs.model).toBeDefined();
  });

  it('限流 key 用 userId 维度（不是 IP）', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'user-abc' } } as never);
    mockedStreamText.mockReturnValueOnce({} as never);

    await POST(makeRequest(validBody));

    const rateLimitKey = mockedRateLimit.mock.calls[0]![0]! as any;
    expect(rateLimitKey).toBe('ai-agent:user-abc');
  });
});
