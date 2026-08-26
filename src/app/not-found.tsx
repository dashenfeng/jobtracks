import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * 404 页面
 * - 所有未匹配路由的兜底
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <Card className="max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">404</CardTitle>
          <CardDescription>页面不存在或已被移动。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm">
            <Link href="/">回首页</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
