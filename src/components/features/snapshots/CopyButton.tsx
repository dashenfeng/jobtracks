'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy}>
      {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
      复制
    </Button>
  );
}
