import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * 环境变量校验测试
 *
 * 注意：env.ts 在模块加载时就执行 loadEnv()，所以测试需要
 * 先 reset mock，再重新 import 模块
 */

describe('lib/env', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // 设置完整合法的环境变量
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      AUTH_SECRET: 'a'.repeat(32),
      AUTH_URL: 'https://app.jobtracks.xyz',
      DEEPSEEK_API_KEY: 'sk-xxx',
      NODE_ENV: 'test',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('所有变量合法 → 不 throw', async () => {
    const { env } = await import('@/lib/env');
    expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
    expect(env.AUTH_SECRET).toBe('a'.repeat(32));
    expect(env.AUTH_URL).toBe('https://app.jobtracks.xyz');
    expect(env.DEEPSEEK_API_KEY).toBe('sk-xxx');
  });

  it('DEEPSEEK_MODEL 缺省 → 默认 deepseek-v4-flash', async () => {
    delete (process.env as Record<string, string>).DEEPSEEK_MODEL;
    const { env } = await import('@/lib/env');
    expect(env.DEEPSEEK_MODEL).toBe('deepseek-v4-flash');
  });

  it('缺少 DATABASE_URL → throw', async () => {
    delete (process.env as Record<string, string>).DATABASE_URL;
    await expect(import('@/lib/env')).rejects.toThrow('DATABASE_URL');
  });

  it('AUTH_SECRET < 32 位 → throw', async () => {
    process.env.AUTH_SECRET = 'short';
    await expect(import('@/lib/env')).rejects.toThrow('AUTH_SECRET');
  });

  it('缺少 DEEPSEEK_API_KEY → throw', async () => {
    delete (process.env as Record<string, string>).DEEPSEEK_API_KEY;
    await expect(import('@/lib/env')).rejects.toThrow('DEEPSEEK_API_KEY');
  });

  it('NODE_ENV 缺省 → 默认 development', async () => {
    delete (process.env as Record<string, string>).NODE_ENV;
    const { env } = await import('@/lib/env');
    expect(env.NODE_ENV).toBe('development');
  });
});
