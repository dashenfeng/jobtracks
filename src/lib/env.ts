import { z } from 'zod';

/**
 * 环境变量校验
 *
 * 启动时校验所有必需环境变量，缺失立即 throw
 * 避免 build 通过但运行时 500 的难以排查问题
 *
 * 使用方式：import { env } from '@/lib/env';
 */
const envSchema = z.object({
  /** 数据库连接串 */
  DATABASE_URL: z.string().url().or(z.string().min(1)),
  /** NextAuth 密钥（JWT 签名） */
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET 至少 32 位'),
  /** 站点 URL（NextAuth callbackUrl 基础，本地开发可缺省） */
  AUTH_URL: z
    .string()
    .url()
    .optional()
    .default('http://localhost:3000'),
  /** DeepSeek API Key */
  DEEPSEEK_API_KEY: z.string().min(1),
  /** DeepSeek 模型名（可选，默认 deepseek-v4-flash） */
  DEEPSEEK_MODEL: z.string().optional().default('deepseek-v4-flash'),
  /** Node 环境 */
  NODE_ENV: z.enum(['development', 'test', 'production']).optional().default('development'),
});

function loadEnv() {
  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`环境变量校验失败：\n${missing}\n\n请检查 .env 或 Vercel 环境变量配置`);
  }

  return parsed.data;
}

export const env = loadEnv();
