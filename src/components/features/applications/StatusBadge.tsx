import { Status } from '@prisma/client';

import { Badge } from '@/components/ui/badge';
import { STATUS_MAP } from '@/lib/constants/applications';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status];
  return (
    <Badge variant={config.badge} className={cn('gap-1.5', className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </Badge>
  );
}
