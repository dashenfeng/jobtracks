'use client';

import { Wrench, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PlaceholderProps {
  title: string;
  description?: string;
}

export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center p-20 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Wrench size={28} className="text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mb-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        <Badge variant="secondary" className="gap-1.5">
          <Loader2 size={13} className="animate-spin" />
          开发中
        </Badge>
      </CardContent>
    </Card>
  );
}
