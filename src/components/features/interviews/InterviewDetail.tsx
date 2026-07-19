'use client';

import { useRouter } from 'next/navigation';
import { Interview, InterviewQuestion, Application } from '@prisma/client';
import { Pencil, Clock, MapPin, User, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { InterviewFormDialog } from './InterviewFormDialog';
import { QuestionList } from './QuestionList';
import {
  INTERVIEW_TYPE_MAP,
  INTERVIEW_STATUS_MAP,
} from '@/lib/constants/interviews';
import { formatDateTime } from '@/lib/utils';

type InterviewDetailData = Interview & {
  application: Pick<Application, 'id' | 'companyName' | 'jobTitle'>;
  questions: InterviewQuestion[];
};

interface InterviewDetailProps {
  interview: InterviewDetailData;
}

export function InterviewDetail({ interview }: InterviewDetailProps) {
  const router = useRouter();
  const statusConfig = INTERVIEW_STATUS_MAP[interview.status];
  const typeConfig = INTERVIEW_TYPE_MAP[interview.type];

  const infoItems = [
    { label: '面试时间', value: formatDateTime(interview.scheduledAt), icon: Clock },
    ...(interview.durationMin
      ? [{ label: '时长', value: `${interview.durationMin} 分钟`, icon: Clock }]
      : []),
    ...(interview.location
      ? [{ label: '地点', value: interview.location, icon: MapPin }]
      : []),
    ...(interview.interviewer
      ? [{ label: '面试官', value: interview.interviewer, icon: User }]
      : []),
  ];

  return (
    <div className="space-y-8">
      {/* 标题区 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {interview.application.companyName}
            </h1>
            <Badge variant={statusConfig.badge}>{statusConfig.label}</Badge>
          </div>
          <p className="text-base text-muted-foreground">
            第 {interview.round} 轮 · {typeConfig.label}
            {interview.application.jobTitle ? ` · ${interview.application.jobTitle}` : ''}
          </p>
        </div>
        <InterviewFormDialog
          mode="edit"
          applicationId={interview.application.id}
          interview={interview}
          trigger={
            <Button variant="outline">
              <Pencil className="size-4" />
              编辑
            </Button>
          }
          onSuccess={() => router.refresh()}
        />
      </div>

      {/* 信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold tracking-tight">面试信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {infoItems.map((item) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <item.icon className="size-3.5" />
                  {item.label}
                </div>
                <div className="text-sm font-medium text-foreground">{item.value}</div>
              </div>
            ))}
          </div>
          {interview.overallNotes && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="size-3.5" />
                  整体备注
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {interview.overallNotes}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 面经题目（可增删改） */}
      <QuestionList
        interviewId={interview.id}
        questions={interview.questions}
      />
    </div>
  );
}
