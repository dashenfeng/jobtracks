'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Channel, Status, Application } from '@prisma/client';

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
import { CHANNEL_OPTIONS, STATUS_OPTIONS } from '@/lib/constants/applications';
import { applicationSchema, ApplicationInput } from '@/lib/validations/application';

interface ApplicationFormDialogProps {
  mode: 'create' | 'edit';
  application?: Pick<
    Application,
    'id' | 'companyName' | 'jobTitle' | 'jobUrl' | 'city' | 'channel' | 'status' | 'salaryRange' | 'notes'
  >;
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

const EMPTY_FORM: ApplicationInput = {
  companyName: '',
  jobTitle: '',
  jobUrl: '',
  city: '',
  channel: Channel.OTHER,
  status: Status.PENDING,
  salaryRange: '',
  notes: '',
};

export function ApplicationFormDialog({
  mode,
  application,
  trigger,
  onSuccess,
}: ApplicationFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<ApplicationInput>(
    application
      ? {
          companyName: application.companyName,
          jobTitle: application.jobTitle,
          jobUrl: application.jobUrl ?? '',
          city: application.city ?? '',
          channel: application.channel,
          status: application.status,
          salaryRange: application.salaryRange ?? '',
          notes: application.notes ?? '',
        }
      : EMPTY_FORM
  );

  function update<K extends keyof ApplicationInput>(key: K, value: ApplicationInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const parsed = applicationSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '参数错误');
      return;
    }

    setLoading(true);
    try {
      const url = mode === 'create' ? '/api/applications' : `/api/applications/${application!.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
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
          <DialogTitle>{mode === 'create' ? '新增投递' : '编辑投递'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? '记录一次新的求职投递' : '修改投递信息'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">
                  公司名称 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={(e) => update('companyName', e.target.value)}
                  placeholder="如：字节跳动"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">
                  职位名称 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="jobTitle"
                  value={form.jobTitle}
                  onChange={(e) => update('jobTitle', e.target.value)}
                  placeholder="如：前端工程师"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="channel">招聘渠道</Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) => update('channel', v as Channel)}
                >
                  <SelectTrigger id="channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">当前状态</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => update('status', v as Status)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">城市</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  placeholder="如：北京"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salaryRange">薪资范围</Label>
                <Input
                  id="salaryRange"
                  value={form.salaryRange}
                  onChange={(e) => update('salaryRange', e.target.value)}
                  placeholder="如：25-40K·15薪"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobUrl">职位链接</Label>
              <Input
                id="jobUrl"
                type="url"
                value={form.jobUrl}
                onChange={(e) => update('jobUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">备注</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="面试安排、联系人、HR反馈等"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
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
