'use client';

import { useEffect, useState } from 'react';
import { Status } from '@prisma/client';
import { Check, Loader2 } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/features/applications/StatusBadge';
import {
  STATUS_FLOW,
  STATUS_MAP,
  STATUS_TERMINAL,
} from '@/lib/constants/applications';
import { cn } from '@/lib/utils';

interface StatusSwitcherProps {
  id: string;
  status: Status;
  /** 切换成功后的回调（通常用于刷新列表） */
  onSuccess?: () => void;
  className?: string;
}

/**
 * 状态快速流转：点击 Badge 弹出菜单，选择新状态后立即 PATCH
 * 用于列表页和详情页
 */
export function StatusSwitcher({ id, status, onSuccess, className }: StatusSwitcherProps) {
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<Status>(status);

  // 外部 status 变化时同步（如列表刷新后 item.status 更新）
  useEffect(() => {
    setCurrent(status);
  }, [status]);

  async function handleChange(next: Status) {
    if (next === current || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/applications/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('更新失败');
      setCurrent(next);
      onSuccess?.();
    } catch {
      // 失败保持原状态，不弹 toast（避免列表里太多干扰）
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={loading}
          title="点击切换状态"
          className={cn(
            'inline-flex items-center rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          <StatusBadge status={current} />
          {loading && (
            <Loader2 className="ml-1.5 size-3 animate-spin text-muted-foreground" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          流程中
        </DropdownMenuLabel>
        {STATUS_FLOW.map((s) => (
          <StatusMenuItem
            key={s}
            value={s}
            active={s === current}
            disabled={loading}
            onSelect={handleChange}
          />
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          终态
        </DropdownMenuLabel>
        {STATUS_TERMINAL.map((s) => (
          <StatusMenuItem
            key={s}
            value={s}
            active={s === current}
            disabled={loading}
            onSelect={handleChange}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusMenuItem({
  value,
  active,
  disabled,
  onSelect,
}: {
  value: Status;
  active: boolean;
  disabled: boolean;
  onSelect: (v: Status) => void;
}) {
  const config = STATUS_MAP[value];
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={() => onSelect(value)}
      className="gap-2"
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      <span className="flex-1">{config.label}</span>
      {active && <Check className="size-3.5 text-muted-foreground" />}
    </DropdownMenuItem>
  );
}
