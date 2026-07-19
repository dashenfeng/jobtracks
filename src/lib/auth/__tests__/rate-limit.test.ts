import { describe, it, expect, beforeEach } from 'vitest';
import {
  rateLimit,
  getClientIp,
  cleanupRateLimit,
} from '@/lib/auth/rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    cleanupRateLimit();
  });

  it('首次调用返回 true 并初始化计数', () => {
    expect(rateLimit('k1', 5, 60_000)).toBe(true);
  });

  it('未超限时返回 true 并递增计数', () => {
    expect(rateLimit('k2', 3, 60_000)).toBe(true);
    expect(rateLimit('k2', 3, 60_000)).toBe(true);
    expect(rateLimit('k2', 3, 60_000)).toBe(true);
  });

  it('达到上限后返回 false', () => {
    const key = 'k3';
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(false);
    expect(rateLimit(key, 2, 60_000)).toBe(false);
  });

  it('不同 key 互不影响', () => {
    expect(rateLimit('a', 1, 60_000)).toBe(true);
    expect(rateLimit('a', 1, 60_000)).toBe(false);
    // b 仍可用
    expect(rateLimit('b', 1, 60_000)).toBe(true);
  });

  it('窗口过期后重新计数', () => {
    // 使用极短窗口模拟过期
    expect(rateLimit('k4', 1, 1)).toBe(true);
    // 等待窗口过期
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(rateLimit('k4', 1, 1)).toBe(true);
        resolve();
      }, 5);
    });
  });
});

describe('getClientIp', () => {
  it('优先使用 x-forwarded-for', () => {
    const req = new Request('https://example.com', {
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        'x-real-ip': '9.9.9.9',
      },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('无 x-forwarded-for 时使用 x-real-ip', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-real-ip': '9.9.9.9' },
    });
    expect(getClientIp(req)).toBe('9.9.9.9');
  });

  it('两者都无时返回 unknown', () => {
    const req = new Request('https://example.com');
    expect(getClientIp(req)).toBe('unknown');
  });

  it('x-forwarded-for 含多个 IP 时取第一个', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': ' 10.0.0.1 , 10.0.0.2' },
    });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });
});
