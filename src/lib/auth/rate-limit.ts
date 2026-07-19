/**
 * 简易内存限流（单进程够用，生产可换 Upstash Redis）
 *
 * 使用方式：
 *   if (!rateLimit(ip, 5, 60_000)) return 429;
 */

interface Hit {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Hit>();

/**
 * @param key 限流维度（IP 或 IP+path）
 * @param max 窗口内最大次数
 * @param windowMs 窗口大小（毫秒）
 * @returns true=允许，false=超限
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hit = buckets.get(key);

  // 无记录或窗口已过期 → 重新计数
  if (!hit || hit.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (hit.count >= max) return false;
  hit.count++;
  return true;
}

/**
 * 从请求头提取客户端 IP
 * 优先级：x-forwarded-for > x-real-ip > unknown
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * 清理过期桶（可选，避免内存泄漏，定时调用）
 */
export function cleanupRateLimit(): void {
  const now = Date.now();
  for (const [key, hit] of buckets) {
    if (hit.resetAt < now) buckets.delete(key);
  }
}

/**
 * 清空所有限流桶（仅用于测试隔离）
 */
export function _resetRateLimitForTest(): void {
  buckets.clear();
}
