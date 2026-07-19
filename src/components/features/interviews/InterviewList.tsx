'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Interview, InterviewQuestion } from '@prisma/client';
import { Plus, Pencil, Trash2, ExternalLink, Inbox, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InterviewFormDialog } from './InterviewFormDialog';
import { INTERVIEW_TYPE_MAP, INTERVIEW_STATUS_MAP } from '@/lib/constants/interviews';
import { formatDateTime } from '@/lib/utils';

type InterviewWithQuestions = Interview & { questions: InterviewQuestion[] };

interface InterviewListProps {
  applicationId: string;
  companyName: string;
  interviews: InterviewWithQuestions[];
}

export function InterviewList({
  applicationId,
  companyName,
  interviews,
}: InterviewListProps) {
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
      const res = await fetch(`/api/interviews/${deleteId}`, { method: 'DELETE' });
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
        <p className="text-sm text-muted-foreground">共 {interviews.length} 场面试</p>
        <InterviewFormDialog
          mode="create"
          applicationId={applicationId}
          trigger={
            <Button>
              <Plus className="size-4" />
              新增面试
            </Button>
          }
          onSuccess={refresh}
        />
      </div>

      {interviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">还没有面试记录</p>
              <p className="mt-1 text-sm text-muted-foreground">
                为 {companyName} 添加第一场面试吧
              </p>
            </div>
            <InterviewFormDialog
              mode="create"
              applicationId={applicationId}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  新增面试
                </Button>
              }
              onSuccess={refresh}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {interviews.map((interview) => {
            const statusConfig = INTERVIEW_STATUS_MAP[interview.status];
            const typeConfig = INTERVIEW_TYPE_MAP[interview.type];
            return (
              <Card key={interview.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1.5">
                    <CardTitle className="text-lg font-semibold tracking-tight">
                      第 {interview.round} 轮 · {typeConfig.label}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span>{formatDateTime(interview.scheduledAt)}</span>
                      {interview.durationMin && (
                        <span>· {interview.durationMin} 分钟</span>
                      )}
                      {interview.location && <span>· {interview.location}</span>}
                      {interview.interviewer && (
                        <span>· 面试官：{interview.interviewer}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant={statusConfig.badge}>{statusConfig.label}</Badge>
                </CardHeader>
                <CardContent>
                  {interview.overallNotes && (
                    <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {interview.overallNotes}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/interviews/${interview.id}`}>
                        <ExternalLink className="size-4" />
                        查看详情
                      </Link>
                    </Button>
                    <InterviewFormDialog
                      mode="edit"
                      applicationId={applicationId}
                      interview={interview}
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
                      onClick={() => setDeleteId(interview.id)}
                    >
                      <Trash2 className="size-4" />
                      删除
                    </Button>
                  </div>
                </CardContent>
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
              删除后该面试及其所有面经题目将无法恢复，确定要删除吗？
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
