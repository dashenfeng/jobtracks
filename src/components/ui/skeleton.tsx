import { cn } from '@/lib/utils';

/**
 * 骨架屏组件（shadcn/ui 风格）
 *
 * 数据加载时的占位元素，用 pulse 动画模拟内容正在加载
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export { Skeleton };
