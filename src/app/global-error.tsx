'use client';

import { useEffect } from 'react';

/**
 * 全局错误边界
 * - 当 root layout 自身抛错时触发（error.tsx 无法捕获 layout 错误）
 * - 必须自带 html/body，不依赖父 layout
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#0a0a0a',
          color: '#fafafa',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            应用崩溃了
          </h1>
          <p style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '1.5rem' }}>
            发生了严重错误，整个应用无法渲染。请尝试刷新页面。
          </p>
          {process.env.NODE_ENV === 'development' && (
            <pre
              style={{
                fontSize: '0.75rem',
                opacity: 0.5,
                textAlign: 'left',
                overflowX: 'auto',
                background: '#111',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                marginBottom: '1.5rem',
              }}
            >
              {error.message}
            </pre>
          )}
          <button
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
