'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { InterviewQuestion, QuestionDifficulty, QuestionPerformance } from '@prisma/client';

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
  DIFFICULTY_OPTIONS,
  PERFORMANCE_OPTIONS,
} from '@/lib/constants/interviews';

interface QuestionFormDialogProps {
  mode: 'create' | 'edit';
  interviewId: string;
  question?: Pick<
    InterviewQuestion,
    'id' | 'question' | 'myAnswer' | 'referenceAnswer' | 'tags' | 'difficulty' | 'performance'
  >;
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

interface QuestionFormState {
  question: string;
  difficulty: QuestionDifficulty;
  performance: QuestionPerformance;
  tags: string;
  myAnswer: string;
  referenceAnswer: string;
}

const EMPTY_FORM: QuestionFormState = {
  question: '',
  difficulty: QuestionDifficulty.EASY,
  performance: QuestionPerformance.OKAY,
  tags: '',
  myAnswer: '',
  referenceAnswer: '',
};

export function QuestionFormDialog({
  mode,
  interviewId,
  question,
  trigger,
  onSuccess,
}: QuestionFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<QuestionFormState>(
    question
      ? {
          question: question.question,
          difficulty: question.difficulty,
          performance: question.performance,
          tags: question.tags.join(', '),
          myAnswer: question.myAnswer ?? '',
          referenceAnswer: question.referenceAnswer ?? '',
        }
      : EMPTY_FORM
  );

  function update<K extends keyof QuestionFormState>(key: K, value: QuestionFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.question.trim()) {
      setError('请输入面试题目');
      return;
    }

    const payload = {
      question: form.question.trim(),
      difficulty: form.difficulty,
      performance: form.performance,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      myAnswer: form.myAnswer,
      referenceAnswer: form.referenceAnswer,
    };

    setLoading(true);
    try {
      const url =
        mode === 'create'
          ? `/api/interviews/${interviewId}/questions`
          : `/api/interviews/questions/${question!.id}`;
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
          <DialogTitle>{mode === 'create' ? '新增题目' : '编辑题目'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? '记录一道面经题目' : '修改题目信息'}
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
              <Label htmlFor="question">
                面试题目 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="question"
                value={form.question}
                onChange={(e) => update('question', e.target.value)}
                placeholder="面试题目"
                required
                autoFocus
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="difficulty">难度</Label>
                <Select
                  value={form.difficulty}
                  onValueChange={(v) => update('difficulty', v as QuestionDifficulty)}
                >
                  <SelectTrigger id="difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="performance">表现</Label>
                <Select
                  value={form.performance}
                  onValueChange={(v) => update('performance', v as QuestionPerformance)}
                >
                  <SelectTrigger id="performance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERFORMANCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">标签</Label>
              <Input
                id="tags"
                value={form.tags}
                onChange={(e) => update('tags', e.target.value)}
                placeholder="React, Hooks, useEffect"
              />
              <p className="text-xs text-muted-foreground">多个标签用英文逗号分隔</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="myAnswer">我的回答</Label>
              <Textarea
                id="myAnswer"
                value={form.myAnswer}
                onChange={(e) => update('myAnswer', e.target.value)}
                placeholder="记录当时作答的内容"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceAnswer">参考答案</Label>
              <Textarea
                id="referenceAnswer"
                value={form.referenceAnswer}
                onChange={(e) => update('referenceAnswer', e.target.value)}
                placeholder="记录标准答案或优化思路"
                rows={4}
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
