import { describe, it, expect, beforeEach, vi } from 'vitest';

// mock bcrypt + prisma + rate-limit，避免触碰真实依赖
vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue(true),
  _resetRateLimitForTest: vi.fn(),
}));

// 必须在 mock 之后 import
import bcrypt from 'bcryptjs';
import { authorizeCredentials } from '@/lib/auth/authorize';
import { prisma } from '@/lib/db';
import { rateLimit, _resetRateLimitForTest } from '@/lib/auth/rate-limit';

const mockedCompare = vi.mocked(bcrypt.compare);
const mockedFindUnique = vi.mocked(prisma.user.findUnique);
const mockedRateLimit = vi.mocked(rateLimit);

describe('authorizeCredentials (登录校验)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimitForTest();
    // 默认通过限流
    mockedRateLimit.mockReturnValue(true);
  });

  it('邮箱格式非法 → null（不查库、不调 bcrypt）', async () => {
    const result = await authorizeCredentials({ email: 'not-email', password: '123456' });
    expect(result).toBeNull();
    expect(mockedFindUnique).not.toHaveBeenCalled();
    expect(mockedCompare).not.toHaveBeenCalled();
  });

  it('密码 < 6 位 → null（不查库、不调 bcrypt）', async () => {
    const result = await authorizeCredentials({ email: 'a@b.com', password: '12345' });
    expect(result).toBeNull();
    expect(mockedFindUnique).not.toHaveBeenCalled();
    expect(mockedCompare).not.toHaveBeenCalled();
  });

  it('凭据不是对象 → null', async () => {
    const result = await authorizeCredentials(null);
    expect(result).toBeNull();
    expect(mockedFindUnique).not.toHaveBeenCalled();
  });

  it('触发限流 → null（不查库）', async () => {
    mockedRateLimit.mockReturnValueOnce(false);

    const result = await authorizeCredentials({ email: 'a@b.com', password: '123456' });

    expect(result).toBeNull();
    expect(mockedFindUnique).not.toHaveBeenCalled();
    // 验证限流 key 用 email 维度
    expect(mockedRateLimit.mock.calls[0][0]).toBe('login:a@b.com');
    expect(mockedRateLimit.mock.calls[0][1]).toBe(5);
    expect(mockedRateLimit.mock.calls[0][2]).toBe(60_000);
  });

  it('用户不存在 → null（不调 bcrypt）', async () => {
    mockedFindUnique.mockResolvedValueOnce(null as never);

    const result = await authorizeCredentials({ email: 'nobody@example.com', password: '12345678' });

    expect(result).toBeNull();
    expect(mockedCompare).not.toHaveBeenCalled();
  });

  it('用户存在但 password 字段为 null（OAuth 用户）→ null（不调 bcrypt）', async () => {
    mockedFindUnique.mockResolvedValueOnce({
      id: 'u1',
      email: 'oauth@b.com',
      name: 'OAuth User',
      password: null,
    } as never);

    const result = await authorizeCredentials({ email: 'oauth@b.com', password: '12345678' });

    expect(result).toBeNull();
    expect(mockedCompare).not.toHaveBeenCalled();
  });

  it('bcrypt.compare 返回 false（密码错误）→ null', async () => {
    mockedFindUnique.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      password: '$2a$10$hash',
    } as never);
    mockedCompare.mockResolvedValueOnce(false as never);

    const result = await authorizeCredentials({ email: 'a@b.com', password: 'wrong-password' });

    expect(result).toBeNull();
    expect(mockedCompare).toHaveBeenCalledOnce();
  });

  it('正常登录成功 → 返回 { id, email, name }', async () => {
    mockedFindUnique.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      password: '$2a$10$hash',
    } as never);
    mockedCompare.mockResolvedValueOnce(true as never);

    const result = await authorizeCredentials({ email: 'a@b.com', password: 'Pass1234' });

    expect(result).toEqual({ id: 'u1', email: 'a@b.com', name: 'Alice' });
    expect(mockedCompare).toHaveBeenCalledOnce();
    // 验证 bcrypt.compare 收到明文 + hash
    const compareArgs = mockedCompare.mock.calls[0];
    expect(compareArgs[0]).toBe('Pass1234');
    expect(compareArgs[1]).toBe('$2a$10$hash');
  });

  it('密码 6-7 位（通过 schema 但 DB hash 是 8+ 位）→ schema 通过但 bcrypt 失败', async () => {
    // 这个测试明确断言"密码策略不一致不是 bug"：
    // - 注册路由要求 8 位 + 字母 + 数字
    // - 登录 authorize 只要求 6 位
    // - 但 6-7 位密码在 DB 里找不到匹配的 hash，bcrypt.compare 一定返回 false
    mockedFindUnique.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      password: '$2a$10$hash',
    } as never);
    mockedCompare.mockResolvedValueOnce(false as never);

    const result = await authorizeCredentials({ email: 'a@b.com', password: '1234567' });

    // schema 通过（密码 7 位 ≥ 6），但 bcrypt 失败
    expect(result).toBeNull();
    expect(mockedFindUnique).toHaveBeenCalledOnce();
    expect(mockedCompare).toHaveBeenCalledOnce();
  });

  it('凭据字段缺失（email 为 undefined）→ null', async () => {
    const result = await authorizeCredentials({ password: '12345678' });
    expect(result).toBeNull();
    expect(mockedFindUnique).not.toHaveBeenCalled();
  });
});
