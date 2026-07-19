'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Interview, InterviewType, InterviewStatus } from '@prisma/client';

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
import {
  INTERVIEW_TYPE_OPTIONS,
  INTERVIEW_STATUS_OPTIONS,
} from '@/lib/constants/interviews';
import { interviewSchema } from '@/lib/validations/interview';

interface InterviewFormDialogProps {
  mode: 'create' | 'edit';
  applicationId: string;
  interview?: Pick<
    Interview,
    | 'id'
    | 'round'
    | 'type'
    | 'scheduledAt'
    | 'durationMin'
    | 'location'
    | 'interviewer'
    | 'status'
    | 'overallNotes'
  >;
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

/** 将 Date 转为 datetime-local 输入框所需的本地时间字符串 */
function toDatetimeLocal(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function InterviewFormDialog({
  mode,
  applicationId,
  interview,
  trigger,
  onSuccess,
}: InterviewFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [round, setRound] = useState<string>(interview ? String(interview.round) : '1');
  const [type, setType] = useState<InterviewType>(interview?.type ?? InterviewType.VIDEO);
  const [scheduledAt, setScheduledAt] = useState<string>(
    interview ? toDatetimeLocal(interview.scheduledAt) : ''
  );
  const [durationMin, setDurationMin] = useState<string>(
    interview?.durationMin ? String(interview.durationMin) : ''
  );
  const [location, setLocation] = useState<string>(interview?.location ?? '');
  const [interviewer, setInterviewer] = useState<string>(interview?.interviewer ?? '');
  const [status, setStatus] = useState<InterviewStatus>(
    interview?.status ?? InterviewStatus.SCHEDULED
  );
  const [overallNotes, setOverallNotes] = useState<string>(interview?.overallNotes ?? '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!scheduledAt) {
      setError('请选择面试时间');
      return;
    }

    const payload = {
      round: Number(round),
      type,
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMin: durationMin ? Number(durationMin) : null,
      location,
      interviewer,
      status,
      overallNotes,
    };

    const parsed = interviewSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '参数错误');
      return;
    }

    setLoading(true);
    try {
      const url =
        mode === 'create'
          ? `/api/applications/${applicationId}/interviews`
          : `/api/interviews/${interview!.id}`;
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
          <DialogTitle>{mode === 'create' ? '新增面试' : '编辑面试'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? '记录一场新的面试安排' : '修改面试信息'}
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
                <Label htmlFor="round">
                  轮次 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="round"
                  type="number"
                  min={1}
                  max={10}
                  value={round}
                  onChange={(e) => setRound(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">
                  面试形式 <span className="text-destructive">*</span>
                </Label>
                <Select value={type} onValueChange={(v) => setType(v as InterviewType)}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_TYPE_OPTIONS.map((opt) => (
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
                <Label htmlFor="scheduledAt">
                  面试时间 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationMin">时长（分钟）</Label>
                <Input
                  id="durationMin"
                  type="number"
                  min={1}
                  max={600}
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  placeholder="可选"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">地点</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="如：北京·抖音大楼 / 腾讯会议"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interviewer">面试官</Label>
                <Input
                  id="interviewer"
                  value={interviewer}
                  onChange={(e) => setInterviewer(e.target.value)}
                  placeholder="可选"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">面试状态</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as InterviewStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="overallNotes">整体备注</Label>
              <Textarea
                id="overallNotes"
                value={overallNotes}
                onChange={(e) => setOverallNotes(e.target.value)}
                placeholder="整体感受、需要注意的点等"
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
