import { describe, it, expect, beforeEach, vi } from 'vitest';

// mock @prisma/client 的 enum（service.ts 用到了 NotificationType / Status / InterviewStatus）
vi.mock('@prisma/client', () => ({
  NotificationType: {
    INTERVIEW_REMINDER: 'INTERVIEW_REMINDER',
    STATUS_CHANGED: 'STATUS_CHANGED',
  },
  Status: {
    PENDING: 'PENDING',
    APPLIED: 'APPLIED',
    WRITTEN: 'WRITTEN',
    INTERVIEW_1: 'INTERVIEW_1',
    INTERVIEW_2: 'INTERVIEW_2',
    INTERVIEW_3: 'INTERVIEW_3',
    HR: 'HR',
    OFFER: 'OFFER',
    REJECTED: 'REJECTED',
    ABANDONED: 'ABANDONED',
  },
  InterviewStatus: {
    SCHEDULED: 'SCHEDULED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    interview: {
      findMany: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import {
  scanInterviewReminders,
  notifyApplicationStatusChanged,
} from '@/lib/notifications/service';
import { prisma } from '@/lib/db';

const mockedInterviewFindMany = vi.mocked(prisma.interview.findMany);
const mockedNotificationFindMany = vi.mocked(prisma.notification.findMany);
const mockedNotificationCreateMany = vi.mocked(prisma.notification.createMany);
const mockedNotificationCreate = vi.mocked(prisma.notification.create);

describe('scanInterviewReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('没有即将到来的面试时返回 0 且不写通知', async () => {
    mockedInterviewFindMany.mockResolvedValueOnce([] as never);
    const result = await scanInterviewReminders('u1');
    expect(result).toBe(0);
    expect(mockedNotificationCreateMany).not.toHaveBeenCalled();
  });

  it('有新面试但 7 天内已通知过 → 跳过', async () => {
    const interview = {
      id: 'i1',
      userId: 'u1',
      round: 1,
      type: 'VIDEO',
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 小时后
      location: null,
      interviewer: null,
      application: { companyName: 'ACME', jobTitle: '前端' },
    };
    mockedInterviewFindMany.mockResolvedValueOnce([interview] as never);
    // 模拟已通知过
    mockedNotificationFindMany.mockResolvedValueOnce([
      { metadata: { interviewId: 'i1' } },
    ] as never);

    const result = await scanInterviewReminders('u1');
    expect(result).toBe(0);
    expect(mockedNotificationCreateMany).not.toHaveBeenCalled();
  });

  it('有新面试且未通知过 → 生成通知', async () => {
    const interview = {
      id: 'i1',
      userId: 'u1',
      round: 1,
      type: 'VIDEO',
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      location: '会议室 A',
      interviewer: '张三',
      application: { companyName: 'ACME', jobTitle: '前端' },
    };
    mockedInterviewFindMany.mockResolvedValueOnce([interview] as never);
    mockedNotificationFindMany.mockResolvedValueOnce([] as never);
    mockedNotificationCreateMany.mockResolvedValueOnce({ count: 1 } as never);

    const result = await scanInterviewReminders('u1');
    expect(result).toBe(1);
    expect(mockedNotificationCreateMany).toHaveBeenCalledOnce();
    // 验证 metadata 含 interviewId 用于去重
    const callArgs = mockedNotificationCreateMany.mock.calls[0][0];
    expect(callArgs.data[0].metadata).toMatchObject({ interviewId: 'i1' });
    expect(callArgs.data[0].type).toBe('INTERVIEW_REMINDER');
  });

  it('面试扫描失败时抛出（让上层 try/catch 兜底）', async () => {
    mockedInterviewFindMany.mockRejectedValueOnce(new Error('DB down') as never);
    await expect(scanInterviewReminders('u1')).rejects.toThrow('DB down');
  });
});

describe('notifyApplicationStatusChanged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('新旧状态相同 → 不创建通知', async () => {
    const result = await notifyApplicationStatusChanged(
      'u1',
      { id: 'app1', companyName: 'ACME', jobTitle: '前端' },
      'APPLIED',
      'APPLIED',
    );
    expect(result).toBeUndefined();
    expect(mockedNotificationCreate).not.toHaveBeenCalled();
  });

  it('状态变更 APPLIED → INTERVIEW_1 → 创建通知', async () => {
    mockedNotificationCreate.mockResolvedValueOnce({ id: 'n1' } as never);

    await notifyApplicationStatusChanged(
      'u1',
      { id: 'app1', companyName: 'ACME', jobTitle: '前端' },
      'APPLIED',
      'INTERVIEW_1',
    );

    expect(mockedNotificationCreate).toHaveBeenCalledOnce();
    const callArgs = mockedNotificationCreate.mock.calls[0][0];
    expect(callArgs.data).toMatchObject({
      userId: 'u1',
      type: 'STATUS_CHANGED',
      title: '投递状态变更',
    });
    // content 含旧状态 → 新状态
    expect(callArgs.data.content).toContain('已投递');
    expect(callArgs.data.content).toContain('一面');
    // link 指向投递详情
    expect(callArgs.data.link).toBe('/applications/app1');
    // metadata 含状态信息
    expect(callArgs.data.metadata).toMatchObject({
      applicationId: 'app1',
      oldStatus: 'APPLIED',
      newStatus: 'INTERVIEW_1',
    });
  });

  it('状态 REJECTED → 含拒绝中文', async () => {
    mockedNotificationCreate.mockResolvedValueOnce({ id: 'n2' } as never);

    await notifyApplicationStatusChanged(
      'u1',
      { id: 'app2', companyName: 'B', jobTitle: '后端' },
      'INTERVIEW_1',
      'REJECTED',
    );

    const callArgs = mockedNotificationCreate.mock.calls[0][0];
    expect(callArgs.data.content).toContain('拒绝');
  });
});
