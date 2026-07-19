import { tool } from 'ai';
import { z } from 'zod';

import { prisma } from '@/lib/db';

/**
 * AI Agent 只读工具集
 *
 * 设计要点：
 * - 所有工具都用 `contextSchema` 声明所需 context（v7 推荐方式），调用方通过
 *   `toolsContext` 按工具名传入。这里所有工具都需要 `userId` 做数据隔离。
 * - 全部为只读查询工具，不暴露任何 create/update/delete。
 * - 工具返回的日期字段统一转成 ISO 字符串，方便 LLM 阅读。
 */

/** 共享 context：所有工具都需要当前用户 ID */
const userContextSchema = z.object({
  userId: z.string().describe('当前登录用户 ID（由服务端注入，模型无需也不能修改）'),
});

/** 将 Date 字段转成 ISO 字符串，避免 LLM 收到 [object Object] */
function toJson<T>(row: T): T {
  return JSON.parse(JSON.stringify(row)) as T;
}

/**
 * 9 个只读工具
 *
 * 命名采用 snake_case，因为 LLM 在 function calling 场景对 snake_case 的识别
 * 比较稳定，且和 OpenAI/DeepSeek 的官方工具命名风格一致。
 */
export const agentTools = {
  // ─────────────── 投递相关 ───────────────

  list_applications: tool({
    description:
      '查询当前用户的投递记录列表，支持按状态/渠道筛选、关键词搜索、分页。默认按更新时间倒序。',
    inputSchema: z.object({
      status: z
        .enum([
          'PENDING',
          'APPLIED',
          'WRITTEN',
          'INTERVIEW_1',
          'INTERVIEW_2',
          'INTERVIEW_3',
          'HR',
          'OFFER',
          'REJECTED',
          'ABANDONED',
        ])
        .optional()
        .describe('投递状态筛选'),
      channel: z
        .enum(['BOSS', 'NIUKER', 'OFFICIAL', 'REFERRAL', 'OTHER'])
        .optional()
        .describe('招聘渠道筛选'),
      keyword: z
        .string()
        .optional()
        .describe('关键词，模糊匹配公司名或职位名'),
      page: z.number().int().min(1).default(1).describe('页码，从 1 开始'),
      pageSize: z.number().int().min(1).max(50).default(20).describe('每页数量，1-50'),
    }),
    contextSchema: userContextSchema,
    execute: async ({ status, channel, keyword, page, pageSize }, { context }) => {
      const where = {
        userId: context.userId,
        ...(status ? { status } : {}),
        ...(channel ? { channel } : {}),
        ...(keyword
          ? {
              OR: [
                { companyName: { contains: keyword, mode: 'insensitive' as const } },
                { jobTitle: { contains: keyword, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        prisma.application.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            companyName: true,
            jobTitle: true,
            city: true,
            channel: true,
            status: true,
            salaryRange: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.application.count({ where }),
      ]);
      return toJson({
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    },
  }),

  get_application_detail: tool({
    description:
      '查询单个投递记录的详情，包含附件列表和该投递下的所有面试记录。需要传入投递 ID。',
    inputSchema: z.object({
      id: z.string().describe('投递记录 ID'),
    }),
    contextSchema: userContextSchema,
    execute: async ({ id }, { context }) => {
      const app = await prisma.application.findFirst({
        where: { id, userId: context.userId },
        include: {
          attachments: {
            select: { id: true, fileName: true, fileType: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
          interviews: {
            select: {
              id: true,
              round: true,
              type: true,
              scheduledAt: true,
              status: true,
              interviewer: true,
            },
            orderBy: { scheduledAt: 'asc' },
          },
        },
      });
      if (!app) return { error: '记录不存在或无权访问' };
      return toJson(app);
    },
  }),

  get_application_stats: tool({
    description:
      '查询当前用户的投递统计：按状态分组的计数，以及汇总指标（总数/进行中/面试中/Offer/已拒绝）。',
    inputSchema: z.object({}),
    contextSchema: userContextSchema,
    execute: async (_input, { context }) => {
      const grouped = await prisma.application.groupBy({
        by: ['status'],
        where: { userId: context.userId },
        _count: { _all: true },
      });
      const counts = grouped.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      }, {});

      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      const inProgress =
        (counts.PENDING ?? 0) +
        (counts.APPLIED ?? 0) +
        (counts.WRITTEN ?? 0) +
        (counts.INTERVIEW_1 ?? 0) +
        (counts.INTERVIEW_2 ?? 0) +
        (counts.INTERVIEW_3 ?? 0) +
        (counts.HR ?? 0);
      const interviewing =
        (counts.INTERVIEW_1 ?? 0) +
        (counts.INTERVIEW_2 ?? 0) +
        (counts.INTERVIEW_3 ?? 0) +
        (counts.HR ?? 0);
      const offer = counts.OFFER ?? 0;
      const rejected = (counts.REJECTED ?? 0) + (counts.ABANDONED ?? 0);

      return { counts, summary: { total, inProgress, interviewing, offer, rejected } };
    },
  }),

  get_application_analytics: tool({
    description:
      '查询当前用户的投递数据分析：包含趋势（最近 6 个月）、状态分布、渠道分布、转化漏斗、关键指标（面试率/Offer 率等）。',
    inputSchema: z.object({}),
    contextSchema: userContextSchema,
    execute: async (_input, { context }) => {
      const apps = await prisma.application.findMany({
        where: { userId: context.userId },
        select: { status: true, channel: true, createdAt: true },
      });

      const total = apps.length;

      // 状态分布
      const statusCounts = new Map<string, number>();
      for (const a of apps) {
        statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
      }
      const statusDistribution = Array.from(statusCounts.entries()).map(([key, value]) => ({
        key,
        value,
      }));

      // 渠道分布
      const channelCounts = new Map<string, number>();
      for (const a of apps) {
        channelCounts.set(a.channel, (channelCounts.get(a.channel) ?? 0) + 1);
      }
      const channelDistribution = Array.from(channelCounts.entries()).map(([key, count]) => ({
        key,
        count,
      }));

      // 月度趋势（最近 6 个月）
      const now = new Date();
      const months: Array<{ month: string; count: number }> = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.push({ month: key, count: 0 });
      }
      const monthMap = new Map(months.map((m) => [m.month, m]));
      for (const a of apps) {
        const d = a.createdAt;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const m = monthMap.get(key);
        if (m) m.count++;
      }

      // 转化漏斗
      const APPLIED_OR_FURTHER = [
        'APPLIED', 'WRITTEN', 'INTERVIEW_1', 'INTERVIEW_2', 'INTERVIEW_3', 'HR', 'OFFER',
      ];
      const WRITTEN_OR_FURTHER = [
        'WRITTEN', 'INTERVIEW_1', 'INTERVIEW_2', 'INTERVIEW_3', 'HR', 'OFFER',
      ];
      const INTERVIEW_OR_FURTHER = ['INTERVIEW_1', 'INTERVIEW_2', 'INTERVIEW_3', 'HR', 'OFFER'];
      const inSet = (s: string, set: string[]) => set.includes(s);
      const funnel = [
        { stage: '已投递', count: apps.filter((a) => inSet(a.status, APPLIED_OR_FURTHER)).length },
        { stage: '笔试', count: apps.filter((a) => inSet(a.status, WRITTEN_OR_FURTHER)).length },
        { stage: '面试', count: apps.filter((a) => inSet(a.status, INTERVIEW_OR_FURTHER)).length },
        { stage: 'Offer', count: apps.filter((a) => a.status === 'OFFER').length },
      ];

      const interviewCount = apps.filter((a) => inSet(a.status, INTERVIEW_OR_FURTHER)).length;
      const offerCount = statusCounts.get('OFFER') ?? 0;
      const activeCount = apps.filter((a) =>
        inSet(a.status, ['PENDING', 'APPLIED', 'WRITTEN', 'INTERVIEW_1', 'INTERVIEW_2', 'INTERVIEW_3', 'HR'])
      ).length;

      return {
        metrics: {
          total,
          interviewCount,
          offerCount,
          activeCount,
          interviewRate: total > 0 ? Number((interviewCount / total).toFixed(4)) : 0,
          offerRate: total > 0 ? Number((offerCount / total).toFixed(4)) : 0,
        },
        trend: months,
        statusDistribution,
        channelDistribution,
        funnel,
      };
    },
  }),

  // ─────────────── 面试相关 ───────────────

  list_interviews: tool({
    description:
      '查询当前用户的面试列表，支持按状态筛选和时间范围筛选。默认按面试时间倒序。包含所属投递的公司名和职位名。',
    inputSchema: z.object({
      status: z
        .enum(['SCHEDULED', 'COMPLETED', 'CANCELLED'])
        .optional()
        .describe('面试状态筛选'),
      from: z
        .string()
        .optional()
        .describe('面试时间起始（ISO 8601 字符串，如 2026-01-01）'),
      to: z
        .string()
        .optional()
        .describe('面试时间截止（ISO 8601 字符串，如 2026-12-31）'),
    }),
    contextSchema: userContextSchema,
    execute: async ({ status, from, to }, { context }) => {
      const where = {
        userId: context.userId,
        ...(status ? { status } : {}),
        ...(from || to
          ? {
              scheduledAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      };
      const items = await prisma.interview.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        include: {
          application: {
            select: { companyName: true, jobTitle: true },
          },
        },
      });
      return toJson(items);
    },
  }),

  get_interview_detail: tool({
    description:
      '查询单个面试的详情，包含所属投递信息和该面试下的所有面经题目（含我的回答、参考答案、难度、表现）。需要传入面试 ID。',
    inputSchema: z.object({
      id: z.string().describe('面试 ID'),
    }),
    contextSchema: userContextSchema,
    execute: async ({ id }, { context }) => {
      const interview = await prisma.interview.findFirst({
        where: { id, userId: context.userId },
        include: {
          application: {
            select: { id: true, companyName: true, jobTitle: true },
          },
          questions: {
            select: {
              id: true,
              question: true,
              myAnswer: true,
              referenceAnswer: true,
              tags: true,
              difficulty: true,
              performance: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!interview) return { error: '记录不存在或无权访问' };
      return toJson(interview);
    },
  }),

  list_review_questions: tool({
    description:
      '查询当前用户的错题本（面经题目）列表，默认返回表现 POOR 或 OKAY 的题目。支持按表现和难度筛选。包含所属面试的公司名/职位名/轮次。',
    inputSchema: z.object({
      performance: z
        .enum(['POOR', 'OKAY', 'GOOD', 'POOR_OKAY', 'ALL'])
        .default('POOR_OKAY')
        .describe('表现筛选，POOR_OKAY=答得差或一般（默认），ALL=全部'),
      difficulty: z
        .enum(['EASY', 'MEDIUM', 'HARD'])
        .optional()
        .describe('难度筛选'),
    }),
    contextSchema: userContextSchema,
    execute: async ({ performance, difficulty }, { context }) => {
      let performanceFilter: string[] | undefined;
      if (performance !== 'ALL') {
        const map: Record<string, string[]> = {
          POOR: ['POOR'],
          OKAY: ['OKAY'],
          GOOD: ['GOOD'],
          POOR_OKAY: ['POOR', 'OKAY'],
        };
        performanceFilter = map[performance];
      }

      const items = await prisma.interviewQuestion.findMany({
        where: {
          userId: context.userId,
          ...(performanceFilter ? { performance: { in: performanceFilter as never } } : {}),
          ...(difficulty ? { difficulty: difficulty as never } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          interview: {
            select: {
              id: true,
              round: true,
              scheduledAt: true,
              application: {
                select: { id: true, companyName: true, jobTitle: true },
              },
            },
          },
        },
      });
      return toJson(items);
    },
  }),

  // ─────────────── 工具库相关 ───────────────

  list_snapshots: tool({
    description:
      '查询当前用户的快照列表（用于代码/文本对比归档）。支持按项目、内容类型、是否基准、关键词筛选。',
    inputSchema: z.object({
      q: z.string().optional().describe('关键词，模糊匹配名称、备注或标签'),
      project: z.string().optional().describe('项目名筛选'),
      contentType: z.string().optional().describe('内容类型筛选（如 json/text）'),
      isBaseline: z
        .boolean()
        .optional()
        .describe('是否只看基准快照'),
    }),
    contextSchema: userContextSchema,
    execute: async ({ q, project, contentType, isBaseline }, { context }) => {
      const where = {
        userId: context.userId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { remarks: { contains: q, mode: 'insensitive' as const } },
                { tags: { has: q } },
              ],
            }
          : {}),
        ...(project ? { project } : {}),
        ...(contentType ? { contentType } : {}),
        ...(isBaseline === true ? { isBaseline: true } : {}),
        ...(isBaseline === false ? { isBaseline: false } : {}),
      };
      const items = await prisma.snapshot.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          contentType: true,
          remarks: true,
          tags: true,
          project: true,
          isBaseline: true,
          baselineId: true,
          contentLength: true,
          createdAt: true,
        },
      });
      return toJson(items);
    },
  }),

  list_changelogs: tool({
    description:
      '查询当前用户的 Changelog 列表（版本变更记录）。支持按变更类型筛选和关键词搜索。返回版本号、发布时间、变更条目数。注意：不包含变更详情，需要详情请提示用户去详情页查看。',
    inputSchema: z.object({
      type: z
        .enum(['NEW', 'FIX', 'IMPROVED', 'BREAKING'])
        .optional()
        .describe('变更类型筛选'),
      q: z
        .string()
        .optional()
        .describe('关键词，模糊匹配版本号或变更描述'),
    }),
    contextSchema: userContextSchema,
    execute: async ({ type, q }, { context }) => {
      const where = {
        userId: context.userId,
        ...(q
          ? {
              OR: [
                { version: { contains: q, mode: 'insensitive' as const } },
                {
                  changes: {
                    some: { description: { contains: q, mode: 'insensitive' as const } },
                  },
                },
              ],
            }
          : {}),
        ...(type ? { changes: { some: { type: type as never } } } : {}),
      };
      const items = await prisma.changelog.findMany({
        where,
        orderBy: { releasedAt: 'desc' },
        select: {
          id: true,
          version: true,
          releasedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { changes: true } },
        },
      });
      return toJson(items);
    },
  }),
};

export type AgentTools = typeof agentTools;
