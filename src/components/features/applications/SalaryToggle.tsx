'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { maskSalary } from '@/lib/utils';

interface SalaryToggleProps {
  value: string | null | undefined;
  /** 默认是否掩码 */
  maskByDefault: boolean;
}

/** 详情页薪资显示：眼睛图标切换 */
export function SalaryToggle({ value, maskByDefault }: SalaryToggleProps) {
  const [visible, setVisible] = useState(!maskByDefault);

  if (!value) {
    return <span className="text-sm font-medium text-foreground">-</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium tabular-nums text-foreground">
        {visible ? value : maskSalary(value)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => setVisible((v) => !v)}
        title={visible ? '掩码' : '显示明文'}
      >
        {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </Button>
    </div>
  );
}
