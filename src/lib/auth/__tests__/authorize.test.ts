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
    const result = await authorizeCredentials({ email: 'not-email', password: 'Pass1234' });
    expect(result).toBeNull();
    expect(mockedFindUnique).not.toHaveBeenCalled();
    expect(mockedCompare).not.toHaveBeenCalled();
  });

  it('密码 < 8 位 → null（不查库、不调 bcrypt）', async () => {
    const result = await authorizeCredentials({ email: 'a@b.com', password: 'Pass123' });
    expect(result).toBeNull();
    expect(mockedFindUnique).not.toHaveBeenCalled();
    expect(mockedCompare).not.toHaveBeenCalled();
  });

  it('密码无字母 → null（不查库、不调 bcrypt）', async () => {
    const result = await authorizeCredentials({ email: 'a@b.com', password: '12345678' });
    expect(result).toBeNull();
    expect(mockedFindUnique).not.toHaveBeenCalled();
    expect(mockedCompare).not.toHaveBeenCalled();
  });

  it('密码无数字 → null（不查库、不调 bcrypt）', async () => {
    const result = await authorizeCredentials({ email: 'a@b.com', password: 'Password' });
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

    const result = await authorizeCredentials({ email: 'a@b.com', password: 'Pass1234' });

    expect(result).toBeNull();
    expect(mockedFindUnique).not.toHaveBeenCalled();
    // 验证限流 key 用 email 维度
    expect(mockedRateLimit.mock.calls[0]![0]! as any).toBe('login:a@b.com');
    expect(mockedRateLimit.mock.calls[0]![1]).toBe(5);
    expect(mockedRateLimit.mock.calls[0]![2]).toBe(60_000);
  });

  it('用户不存在 → null（不调 bcrypt）', async () => {
    mockedFindUnique.mockResolvedValueOnce(null as never);

    const result = await authorizeCredentials({ email: 'nobody@example.com', password: 'Pass1234' });

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

    const result = await authorizeCredentials({ email: 'oauth@b.com', password: 'Pass1234' });

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

    const result = await authorizeCredentials({ email: 'a@b.com', password: 'Wrong1234' });

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

  it('凭据字段缺失（email 为 undefined）→ null', async () => {
    const result = await authorizeCredentials({ password: 'Pass1234' });
    expect(result).toBeNull();
    expect(mockedFindUnique).not.toHaveBeenCalled();
  });
});
