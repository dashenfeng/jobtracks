'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';

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
import { CHANGE_TYPE_OPTIONS } from '@/lib/constants/changelog';
import {
  CHANGE_DESCRIPTION_MAX,
  CHANGES_MAX_COUNT,
  type ChangeType,
} from '@/lib/validations/changelog';

interface ChangeItem {
  id?: string;
  type: ChangeType;
  description: string;
}

interface ChangelogFormDialogProps {
  mode: 'create' | 'edit';
  changelog?: {
    id: string;
    version: string;
    releasedAt: string;
    screenshots: string[];
    changes: ChangeItem[];
  };
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

interface FormState {
  version: string;
  releasedAt: string; // yyyy-mm-dd
  screenshots: string; // 逗号分隔
  changes: ChangeItem[];
}

function toDateInput(dateStr: string): string {
  // ISO 时间 → yyyy-mm-dd
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function ChangelogFormDialog({
  mode,
  changelog,
  trigger,
  onSuccess,
}: ChangelogFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<FormState>(
    changelog
      ? {
          version: changelog.version,
          releasedAt: toDateInput(changelog.releasedAt),
          screenshots: changelog.screenshots.join('\n'),
          changes: changelog.changes.length
            ? changelog.changes.map((c) => ({ ...c }))
            : [{ type: 'NEW', description: '' }],
        }
      : {
          version: '',
          releasedAt: toDateInput(new Date().toISOString()),
          screenshots: '',
          changes: [{ type: 'NEW', description: '' }],
        },
  );

  function addChange() {
    if (form.changes.length >= CHANGES_MAX_COUNT) return;
    setForm((prev) => ({
      ...prev,
      changes: [...prev.changes, { type: 'NEW', description: '' }],
    }));
  }

  function removeChange(idx: number) {
    setForm((prev) => ({
      ...prev,
      changes: prev.changes.filter((_, i) => i !== idx),
    }));
  }

  function updateChange(idx: number, patch: Partial<ChangeItem>) {
    setForm((prev) => ({
      ...prev,
      changes: prev.changes.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.version.trim()) {
      setError('版本号不能为空');
      return;
    }
    if (!form.releasedAt) {
      setError('发布日期不能为空');
      return;
    }

    const validChanges = form.changes.filter((c) => c.description.trim().length > 0);
    if (validChanges.length === 0) {
      setError('至少需要一条变更记录');
      return;
    }
    if (validChanges.some((c) => c.description.length > CHANGE_DESCRIPTION_MAX)) {
      setError(`变更描述最多 ${CHANGE_DESCRIPTION_MAX} 字`);
      return;
    }

    const screenshots = form.screenshots
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = {
      version: form.version.trim(),
      releasedAt: new Date(form.releasedAt).toISOString(),
      screenshots,
      changes: validChanges.map((c) => ({
        type: c.type,
        description: c.description.trim(),
      })),
    };

    setLoading(true);
    try {
      const url = mode === 'create' ? '/api/changelogs' : `/api/changelogs/${changelog!.id}`;
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
      if (onSuccess) {
        onSuccess();
      } else if (mode === 'edit') {
        // 详情页编辑成功后刷新 SSR 数据
        router.refresh();
      }
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
          <DialogTitle>{mode === 'create' ? '新建 Changelog' : '编辑 Changelog'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '记录一个版本的变更，可包含多条变更项'
              : '修改版本信息或变更项'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cl-version">
                  版本号 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cl-version"
                  value={form.version}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, version: e.target.value }))
                  }
                  placeholder="如：v1.2.0"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cl-released">
                  发布日期 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cl-released"
                  type="date"
                  value={form.releasedAt}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, releasedAt: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            {/* 变更项列表 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  变更项 <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addChange}
                  disabled={form.changes.length >= CHANGES_MAX_COUNT}
                >
                  <Plus size={14} />
                  新增一条
                </Button>
              </div>

              <div className="space-y-2">
                {form.changes.map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded-md border border-border p-2"
                  >
                    <Select
                      value={c.type}
                      onValueChange={(v) => updateChange(idx, { type: v as ChangeType })}
                    >
                      <SelectTrigger className="w-32 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHANGE_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={c.description}
                      onChange={(e) =>
                        updateChange(idx, { description: e.target.value })
                      }
                      placeholder="描述本次变更内容"
                      rows={2}
                      className="min-h-0 flex-1"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeChange(idx)}
                      disabled={form.changes.length === 1}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* 截图 URL */}
            <div className="space-y-2">
              <Label htmlFor="cl-shots">截图 URL（可选）</Label>
              <Textarea
                id="cl-shots"
                value={form.screenshots}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, screenshots: e.target.value }))
                }
                placeholder="每行一个 URL"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                每行一个 URL，最多 10 张
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
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
