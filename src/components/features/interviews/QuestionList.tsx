'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InterviewQuestion } from '@prisma/client';
import { Plus, Pencil, Trash2, MessageSquare, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { QuestionFormDialog } from './QuestionFormDialog';
import {
  DIFFICULTY_MAP,
  PERFORMANCE_MAP,
} from '@/lib/constants/interviews';

interface QuestionListProps {
  interviewId: string;
  questions: InterviewQuestion[];
}

export function QuestionList({ interviewId, questions }: QuestionListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function refresh() {
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/interviews/questions/${deleteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('删除失败');
      setDeleteId(null);
      refresh();
    } catch {
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">共 {questions.length} 题</p>
        <QuestionFormDialog
          mode="create"
          interviewId={interviewId}
          trigger={
            <Button>
              <Plus className="size-4" />
              新增题目
            </Button>
          }
          onSuccess={refresh}
        />
      </div>

      {questions.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">还没有面经记录</p>
            <p className="mt-1 text-sm text-muted-foreground">开始记录面试题目吧</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => {
            const difficultyConfig = DIFFICULTY_MAP[q.difficulty];
            const performanceConfig = PERFORMANCE_MAP[q.performance];
            return (
              <Card key={q.id} className="space-y-3 p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Q{idx + 1}</span>
                  <Badge variant={difficultyConfig.badge}>{difficultyConfig.label}</Badge>
                  <Badge variant={performanceConfig.badge}>{performanceConfig.label}</Badge>
                  {q.tags.length > 0 && (
                    <>
                      <span className="mx-1 text-xs text-muted-foreground">·</span>
                      {q.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </>
                  )}
                </div>

                <p className="font-medium leading-relaxed text-foreground">{q.question}</p>

                {q.myAnswer && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">我的回答</p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {q.myAnswer}
                    </p>
                  </div>
                )}

                {q.referenceAnswer && (
                  <div className="space-y-1 rounded-md bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">参考答案</p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {q.referenceAnswer}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <QuestionFormDialog
                    mode="edit"
                    interviewId={interviewId}
                    question={q}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Pencil className="size-4" />
                        编辑
                      </Button>
                    }
                    onSuccess={refresh}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(q.id)}
                  >
                    <Trash2 className="size-4" />
                    删除
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 删除确认 */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后该题目无法恢复，确定要删除吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 size={16} className="animate-spin" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
