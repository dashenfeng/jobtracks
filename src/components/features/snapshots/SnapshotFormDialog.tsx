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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CONTENT_MAX_LENGTH, SNAPSHOT_CONTENT_TYPES } from '@/lib/validations/snapshot';

interface SnapshotFormDialogProps {
  mode: 'create' | 'edit';
  snapshot?: {
    id: string;
    name: string;
    content?: string;
    contentType: string;
    remarks: string | null;
    tags: string[];
    project: string | null;
    isBaseline: boolean;
    baselineId: string | null;
  };
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

interface FormState {
  name: string;
  content: string;
  contentType: string;
  remarks: string;
  tags: string;
  project: string;
  isBaseline: boolean;
}

export function SnapshotFormDialog({
  mode,
  snapshot,
  trigger,
  onSuccess,
}: SnapshotFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<FormState>(
    snapshot
      ? {
          name: snapshot.name,
          content: mode === 'edit' ? '' : (snapshot.content ?? ''),
          contentType: snapshot.contentType,
          remarks: snapshot.remarks ?? '',
          tags: snapshot.tags.join(', '),
          project: snapshot.project ?? '',
          isBaseline: snapshot.isBaseline,
        }
      : {
          name: '',
          content: '',
          contentType: 'json',
          remarks: '',
          tags: '',
          project: '',
          isBaseline: false,
        },
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('名称不能为空');
      return;
    }
    if (mode === 'create' && !form.content.trim()) {
      setError('内容不能为空');
      return;
    }
    if (form.content.length > CONTENT_MAX_LENGTH) {
      setError(`内容过长，最多 ${CONTENT_MAX_LENGTH} 字符`);
      return;
    }

    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      contentType: form.contentType,
      tags,
      remarks: form.remarks,
      project: form.project,
      isBaseline: form.isBaseline,
    };
    // edit 模式下 content 留空表示不修改
    if (mode === 'create' || form.content.trim() !== '') {
      payload.content = form.content;
    }

    setLoading(true);
    try {
      const url = mode === 'create' ? '/api/snapshots' : `/api/snapshots/${snapshot!.id}`;
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建快照' : '编辑快照'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? '保存一份 JSON/XML/文本快照，便于后续对比' : '修改快照信息'}
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
              <Label htmlFor="snap-name">
                名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="snap-name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="如：v1.2.0 API 响应"
                required
                autoFocus
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="snap-type">内容类型</Label>
                <Select
                  value={form.contentType}
                  onValueChange={(v) => update('contentType', v)}
                >
                  <SelectTrigger id="snap-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SNAPSHOT_CONTENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="snap-project">项目</Label>
                <Input
                  id="snap-project"
                  value={form.project}
                  onChange={(e) => update('project', e.target.value)}
                  placeholder="如：jobtracks-api"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="snap-content">
                内容 {mode === 'create' && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id="snap-content"
                value={form.content}
                onChange={(e) => update('content', e.target.value)}
                placeholder="粘贴 JSON / XML / 文本内容"
                rows={10}
                className="font-mono text-xs"
              />
              {mode === 'edit' && (
                <p className="text-xs text-muted-foreground">留空表示不修改内容</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="snap-tags">标签</Label>
              <Input
                id="snap-tags"
                value={form.tags}
                onChange={(e) => update('tags', e.target.value)}
                placeholder="api, baseline"
              />
              <p className="text-xs text-muted-foreground">多个标签用英文逗号分隔</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="snap-remarks">备注</Label>
              <Textarea
                id="snap-remarks"
                value={form.remarks}
                onChange={(e) => update('remarks', e.target.value)}
                placeholder="可选，记录快照来源或用途"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="snap-baseline" className="cursor-pointer">
                  设为基准快照
                </Label>
                <p className="text-xs text-muted-foreground">
                  基准快照可作为后续版本对比的固定参照
                </p>
              </div>
              <Switch
                id="snap-baseline"
                checked={form.isBaseline}
                onCheckedChange={(v) => update('isBaseline', v)}
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
