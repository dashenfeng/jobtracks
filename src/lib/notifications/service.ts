import { prisma } from '@/lib/db';
import {
  NotificationType,
  Status,
  InterviewStatus,
  type Interview,
  type Application,
} from '@prisma/client';

/**
 * 通知服务
 *
 * 设计要点：
 * - 面试临近提醒：扫描"未来 24 小时内"的 SCHEDULED 面试，对每个面试 + 用户组合
 *   生成一条通知，用 metadata.interviewId 去重（同面试只通知一次）
 * - 投递状态变更：每次 application.status 变化时触发，title 含"旧状态 → 新状态"
 * - 状态变更通知不做去重（用户可能反复改状态，每次都该提醒）
 */

/** 状态枚举 → 中文（用于通知文案） */
const STATUS_LABELS: Record<Status, string> = {
  PENDING: '待投递',
  APPLIED: '已投递',
  WRITTEN: '笔试',
  INTERVIEW_1: '一面',
  INTERVIEW_2: '二面',
  INTERVIEW_3: '三面',
  HR: 'HR面',
  OFFER: '录用',
  REJECTED: '拒绝',
  ABANDONED: '放弃',
};

/**
 * 扫描当前用户未来 24 小时内的 SCHEDULED 面试，生成提醒通知
 *
 * 去重策略：用 metadata.interviewId 在最近 7 天内查重，已通知过的不再生成
 *
 * @returns 新生成的通知数量
 */
export async function scanInterviewReminders(userId: string): Promise<number> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // 查未来 24 小时内、状态为 SCHEDULED 的面试
  const upcoming = await prisma.interview.findMany({
    where: {
      userId,
      status: InterviewStatus.SCHEDULED,
      scheduledAt: { gte: now, lte: in24h },
    },
    include: {
      application: { select: { companyName: true, jobTitle: true } },
    },
  });

  if (upcoming.length === 0) return 0;

  // 查最近 7 天内已为这些面试生成过的通知（去重）
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const existing = await prisma.notification.findMany({
    where: {
      userId,
      type: NotificationType.INTERVIEW_REMINDER,
      createdAt: { gte: since },
    },
    select: { metadata: true },
  });
  const notifiedIds = new Set(
    existing
      .map((n) => (n.metadata as { interviewId?: string } | null)?.interviewId)
      .filter((v): v is string => !!v),
  );
  const targetIds = new Set(upcoming.map((i) => i.id));
  const toCreate = upcoming
    .filter((i) => !notifiedIds.has(i.id) && targetIds.has(i.id))
    .map((i) => buildInterviewReminder(i, now));

  if (toCreate.length === 0) return 0;

  await prisma.notification.createMany({ data: toCreate });
  return toCreate.length;
}

/** 构造面试提醒通知 */
function buildInterviewReminder(
  interview: Interview & { application: { companyName: string; jobTitle: string } },
  now: Date,
) {
  const { application, round, type, scheduledAt, location, interviewer } = interview;
  const hoursAway = Math.round((scheduledAt.getTime() - now.getTime()) / (60 * 60 * 1000));
  const timeLabel = hoursAway <= 1 ? '即将' : hoursAway <= 6 ? `${hoursAway} 小时后` : '今天内';

  const typeLabel = type === 'VIDEO' ? '视频' : type === 'PHONE' ? '电话' : '现场';
  const parts = [
    `${application.companyName} · ${application.jobTitle}`,
    `第 ${round} 轮 · ${typeLabel}面试`,
    `时间：${formatDateTime(scheduledAt)}`,
  ];
  if (location) parts.push(`地点：${location}`);
  if (interviewer) parts.push(`面试官：${interviewer}`);

  return {
    userId: interview.userId,
    type: NotificationType.INTERVIEW_REMINDER,
    title: `面试提醒 · ${timeLabel}`,
    content: parts.join('\n'),
    link: '/interviews',
    metadata: { interviewId: interview.id, scheduledAt: scheduledAt.toISOString() },
  };
}

/**
 * 投递状态变更通知
 *
 * @param userId 用户 ID
 * @param application 投递记录（状态变更后的快照）
 * @param oldStatus 旧状态
 * @param newStatus 新状态
 */
export async function notifyApplicationStatusChanged(
  userId: string,
  application: Pick<Application, 'id' | 'companyName' | 'jobTitle'>,
  oldStatus: Status,
  newStatus: Status,
): Promise<void> {
  // 状态没变不通知
  if (oldStatus === newStatus) return;

  const oldLabel = STATUS_LABELS[oldStatus];
  const newLabel = STATUS_LABELS[newStatus];

  await prisma.notification.create({
    data: {
      userId,
      type: NotificationType.STATUS_CHANGED,
      title: '投递状态变更',
      content: `${application.companyName} · ${application.jobTitle}\n${oldLabel} → ${newLabel}`,
      link: `/applications/${application.id}`,
      metadata: {
        applicationId: application.id,
        oldStatus,
        newStatus,
      },
    },
  });
}

/** 简单的日期时间格式化（避免引入 date-fns 在 lib 层） */
function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
