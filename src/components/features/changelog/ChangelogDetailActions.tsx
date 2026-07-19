'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ChangelogDetailActionsProps {
  id: string;
  version: string;
}

export function ChangelogDetailActions({ id, version }: ChangelogDetailActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/changelogs/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '删除失败');
        setDeleting(false);
        return;
      }
      setOpen(false);
      router.push('/tools/changelog');
      router.refresh();
    } catch {
      setError('网络错误');
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">删除此 Changelog</p>
        <p className="text-xs text-muted-foreground">
          删除后不可恢复，所有变更项和截图关联也会一并清除
        </p>
      </div>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 size={14} />
        删除
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && !deleting && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除 Changelog</DialogTitle>
            <DialogDescription>
              确定删除版本{' '}
              <span className="font-medium text-foreground">{version}</span>{' '}
              吗？该操作不可撤销，所有变更项也会一并删除。
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
