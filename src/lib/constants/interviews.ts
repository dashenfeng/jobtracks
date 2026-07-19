import { InterviewType, InterviewStatus, QuestionDifficulty, QuestionPerformance } from '@prisma/client';

/** 面试形式 */
export const INTERVIEW_TYPE_MAP: Record<InterviewType, { label: string; icon: string }> = {
  VIDEO: { label: '视频面试', icon: 'Video' },
  PHONE: { label: '电话面试', icon: 'Phone' },
  ONSITE: { label: '现场面试', icon: 'MapPin' },
};

export const INTERVIEW_TYPE_OPTIONS = Object.entries(INTERVIEW_TYPE_MAP).map(([value, { label }]) => ({
  value: value as InterviewType,
  label,
}));

/** 面试状态 */
export const INTERVIEW_STATUS_MAP: Record<InterviewStatus, { label: string; badge: 'default' | 'secondary' | 'destructive' | 'outline'; dot: string }> = {
  SCHEDULED: { label: '待面试', badge: 'outline', dot: 'bg-blue-500' },
  COMPLETED: { label: '已完成', badge: 'default', dot: 'bg-emerald-500' },
  CANCELLED: { label: '已取消', badge: 'secondary', dot: 'bg-muted-foreground' },
};

export const INTERVIEW_STATUS_OPTIONS = Object.entries(INTERVIEW_STATUS_MAP).map(([value, { label }]) => ({
  value: value as InterviewStatus,
  label,
}));

/** 题目难度 */
export const DIFFICULTY_MAP: Record<QuestionDifficulty, { label: string; badge: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  EASY: { label: '简单', badge: 'secondary' },
  MEDIUM: { label: '中等', badge: 'outline' },
  HARD: { label: '困难', badge: 'destructive' },
};

export const DIFFICULTY_OPTIONS = Object.entries(DIFFICULTY_MAP).map(([value, { label }]) => ({
  value: value as QuestionDifficulty,
  label,
}));

/** 题目表现（用于错题本） */
export const PERFORMANCE_MAP: Record<QuestionPerformance, { label: string; badge: 'default' | 'secondary' | 'destructive' | 'outline'; dot: string }> = {
  GOOD: { label: '答得好', badge: 'default', dot: 'bg-emerald-500' },
  OKAY: { label: '一般', badge: 'outline', dot: 'bg-yellow-500' },
  POOR: { label: '答得差', badge: 'destructive', dot: 'bg-red-500' },
};

export const PERFORMANCE_OPTIONS = Object.entries(PERFORMANCE_MAP).map(([value, { label }]) => ({
  value: value as QuestionPerformance,
  label,
}));
