import { describe, it, expect } from 'vitest';
import { checkCsrf } from '@/lib/auth/csrf';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/api/test', {
    method: 'POST',
    headers,
  });
}

describe('checkCsrf', () => {
  it('缺少 Origin 头时返回 403', async () => {
    const res = checkCsrf(makeRequest({ host: 'example.com' }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toContain('Origin');
  });

  it('缺少 Host 头时返回 403', async () => {
    const res = checkCsrf(makeRequest({ origin: 'https://example.com' }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it('Origin 的 host 与 Host 头不一致时返回 403', async () => {
    const res = checkCsrf(
      makeRequest({
        origin: 'https://evil.com',
        host: 'example.com',
      })
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toContain('Origin 校验失败');
  });

  it('Origin 格式错误时返回 403', async () => {
    const res = checkCsrf(
      makeRequest({
        origin: 'not-a-url',
        host: 'example.com',
      })
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toContain('格式错误');
  });

  it('同源请求返回 null（通过）', () => {
    const res = checkCsrf(
      makeRequest({
        origin: 'https://example.com',
        host: 'example.com',
      })
    );
    expect(res).toBeNull();
  });

  it('带端口的同源请求返回 null', () => {
    const res = checkCsrf(
      makeRequest({
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      })
    );
    expect(res).toBeNull();
  });
});
