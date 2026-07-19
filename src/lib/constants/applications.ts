import { Channel, Status } from '@prisma/client';

/**
 * 投递状态中文映射 + Badge 样式
 * 顺序即流程顺序（PENDING → ... → OFFER/REJECTED/ABANDONED）
 */
export const STATUS_MAP: Record<
  Status,
  { label: string; badge: 'default' | 'secondary' | 'destructive' | 'outline'; dot: string }
> = {
  PENDING: { label: '待投递', badge: 'secondary', dot: 'bg-muted-foreground' },
  APPLIED: { label: '已投递', badge: 'outline', dot: 'bg-blue-500' },
  WRITTEN: { label: '笔试', badge: 'outline', dot: 'bg-cyan-500' },
  INTERVIEW_1: { label: '一面', badge: 'default', dot: 'bg-indigo-500' },
  INTERVIEW_2: { label: '二面', badge: 'default', dot: 'bg-indigo-500' },
  INTERVIEW_3: { label: '三面', badge: 'default', dot: 'bg-violet-500' },
  HR: { label: 'HR面', badge: 'default', dot: 'bg-violet-500' },
  OFFER: { label: '录用', badge: 'default', dot: 'bg-emerald-500' },
  REJECTED: { label: '拒绝', badge: 'destructive', dot: 'bg-red-500' },
  ABANDONED: { label: '放弃', badge: 'secondary', dot: 'bg-muted-foreground' },
};

/** 状态选项（用于 Select 下拉，扁平） */
export const STATUS_OPTIONS = Object.entries(STATUS_MAP).map(([value, { label }]) => ({
  value: value as Status,
  label,
}));

/** 流程中状态（按求职流程顺序） */
export const STATUS_FLOW: Status[] = [
  'PENDING',
  'APPLIED',
  'WRITTEN',
  'INTERVIEW_1',
  'INTERVIEW_2',
  'INTERVIEW_3',
  'HR',
];

/** 终态状态 */
export const STATUS_TERMINAL: Status[] = ['OFFER', 'REJECTED', 'ABANDONED'];

/** 招聘渠道中文映射 */
export const CHANNEL_MAP: Record<Channel, string> = {
  BOSS: 'BOSS直聘',
  NIUKER: '牛客',
  OFFICIAL: '官网',
  REFERRAL: '内推',
  OTHER: '其他',
};

/** 渠道选项（用于 Select 下拉） */
export const CHANNEL_OPTIONS = Object.entries(CHANNEL_MAP).map(([value, label]) => ({
  value: value as Channel,
  label,
}));
