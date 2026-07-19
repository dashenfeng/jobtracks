import { z } from 'zod';

import { InterviewType, InterviewStatus, QuestionDifficulty, QuestionPerformance } from '@prisma/client';

/** 面试场次表单验证 */
export const interviewSchema = z.object({
  round: z.number().int().min(1, '轮次至少为 1').max(10, '轮次最多为 10'),
  type: z.nativeEnum(InterviewType),
  scheduledAt: z.string().or(z.date()).transform((v) => (v instanceof Date ? v : new Date(v))),
  durationMin: z.number().int().min(1).max(600).optional().nullable(),
  location: z.string().max(200).optional().or(z.literal('')),
  interviewer: z.string().max(50).optional().or(z.literal('')),
  status: z.nativeEnum(InterviewStatus).optional(),
  overallNotes: z.string().max(5000).optional().or(z.literal('')),
});

export type InterviewInput = z.infer<typeof interviewSchema>;

/** 面经题目表单验证 */
export const questionSchema = z.object({
  question: z.string().min(1, '题目不能为空').max(2000, '题目最多 2000 字'),
  myAnswer: z.string().max(10000, '回答最多 10000 字').optional().or(z.literal('')),
  referenceAnswer: z.string().max(10000, '参考答案最多 10000 字').optional().or(z.literal('')),
  tags: z.array(z.string().max(30)).max(10, '最多 10 个标签').default([]),
  difficulty: z.nativeEnum(QuestionDifficulty),
  performance: z.nativeEnum(QuestionPerformance),
});

export type QuestionInput = z.infer<typeof questionSchema>;
