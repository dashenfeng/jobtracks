'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EnvVaultFormDialogProps {
  mode: 'create' | 'edit';
  envVault?: { id: string; key: string; tags: string[]; notes: string | null };
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

interface FormState {
  key: string;
  value: string;
  tags: string;
  notes: string;
}

export function EnvVaultFormDialog({
  mode,
  envVault,
  trigger,
  onSuccess,
}: EnvVaultFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<FormState>(
    envVault
      ? {
          key: envVault.key,
          value: '',
          tags: envVault.tags.join(', '),
          notes: envVault.notes ?? '',
        }
      : { key: '', value: '', tags: '', notes: '' },
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.key.trim()) {
      setError('键名不能为空');
      return;
    }

    if (mode === 'create' && !form.value.trim()) {
      setError('值不能为空');
      return;
    }

    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // edit 模式下 value 留空表示不修改
    const payload: Record<string, unknown> = {
      key: form.key.trim(),
      tags,
      notes: form.notes,
    };
    if (mode === 'create' || form.value.trim() !== '') {
      payload.value = form.value;
    }

    setLoading(true);
    try {
      const url =
        mode === 'create' ? '/api/envvault' : `/api/envvault/${envVault!.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '操作失败');
        setLoading(false);
        return;
      }

      setOpen(false);
      onSuccess?.();
    } catch {
      setError('网络错误，请稍后重试');
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增环境变量' : '编辑环境变量'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? '加密存储一条环境变量' : '修改环境变量信息'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="env-key">
                键名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="env-key"
                value={form.key}
                onChange={(e) => update('key', e.target.value)}
                placeholder="如：DATABASE_URL"
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                只能包含字母、数字、下划线，且不能以数字开头
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="env-value">
                值 {mode === 'create' && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id="env-value"
                value={form.value}
                onChange={(e) => update('value', e.target.value)}
                placeholder="支持多行内容"
                rows={4}
              />
              {mode === 'edit' && (
                <p className="text-xs text-muted-foreground">留空表示不修改</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="env-tags">标签</Label>
              <Input
                id="env-tags"
                value={form.tags}
                onChange={(e) => update('tags', e.target.value)}
                placeholder="production, database"
              />
              <p className="text-xs text-muted-foreground">多个标签用英文逗号分隔</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="env-notes">备注</Label>
              <Textarea
                id="env-notes"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="可选，记录用途、归属等信息"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === 'create' ? '创建' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
