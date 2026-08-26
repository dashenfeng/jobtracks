import type { NextConfig } from 'next';

/**
 * 安全响应头配置
 *
 * - X-Frame-Options: DENY — 防止点击劫持，禁止被 iframe 嵌入
 * - X-Content-Type-Options: nosniff — 防止 MIME 嗅探
 * - Referrer-Policy: strict-origin-when-cross-origin — 跨域只暴露 origin
 * - Permissions-Policy — 限制浏览器 API（摄像头/麦克风/地理位置等）
 * - X-DNS-Prefetch-Control: on — 启用 DNS 预取加速
 *
 * CSP 暂未配置：项目用 next/font + inline style + Tailwind，
 * 严格 CSP 需要处理 nonce，留作后续 Phase 3
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig: NextConfig = {
  /** 生产环境压缩 */
  compress: true,
  /** 安全 headers：所有路由生效 */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
