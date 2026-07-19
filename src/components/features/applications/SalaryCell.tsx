import { maskSalary } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface SalaryCellProps {
  /** 薪资原文，如 "30-50K·16薪" */
  value: string | null | undefined;
  /** 是否显示明文（false 时掩码） */
  visible: boolean;
  className?: string;
}

/** 薪资单元格：根据 visible 切换明文/掩码 */
export function SalaryCell({ value, visible, className }: SalaryCellProps) {
  if (!value) {
    return <span className={cn('text-sm text-muted-foreground', className)}>-</span>;
  }
  return (
    <span className={cn('text-sm text-muted-foreground tabular-nums', className)}>
      {visible ? value : maskSalary(value)}
    </span>
  );
}
