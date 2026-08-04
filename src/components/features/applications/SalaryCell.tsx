import { EyeOff } from 'lucide-react';

import { maskSalary } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface SalaryCellProps {
  /** 薪资原文，如 "30-50K·16薪" */
  value: string | null | undefined;
  /** 是否显示明文（false 时掩码） */
  visible: boolean;
  className?: string;
}

/**
 * 薪资单元格：根据 visible 切换明文/掩码
 *
 * 掩码状态会带一个 EyeOff 图标 + tooltip 提示，避免用户误以为渲染 bug
 */
export function SalaryCell({ value, visible, className }: SalaryCellProps) {
  if (!value) {
    return <span className={cn('text-sm text-muted-foreground', className)}>-</span>;
  }
  if (visible) {
    return (
      <span className={cn('text-sm text-foreground tabular-nums', className)}>{value}</span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm text-muted-foreground/70 tabular-nums',
        className,
      )}
      title="薪资已隐藏，点击切换显示"
    >
      <EyeOff className="size-3" aria-hidden />
      <span>{maskSalary(value)}</span>
    </span>
  );
}
