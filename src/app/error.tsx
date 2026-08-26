'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * 路由级错误边界
 * - 捕获子树渲染错误，避免整页白屏
 * - 提供"重试"和"回首页"按钮
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 生产环境可接入 Sentry 上报
    console.error('[app-error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold tracking-tight">
            页面出错了
          </CardTitle>
          <CardDescription>
            渲染过程中发生错误，可以尝试重试或返回首页。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              {error.message}
            </pre>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={reset}>
              重试
            </Button>
            <Button size="sm" variant="outline" onClick={() => (window.location.href = '/')}>
              回首页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
