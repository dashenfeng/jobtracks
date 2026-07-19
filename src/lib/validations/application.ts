import { z } from 'zod';

import { Channel, Status } from '@prisma/client';

/** 新增/编辑投递的表单验证 */
export const applicationSchema = z.object({
  companyName: z.string().min(1, '公司名称不能为空').max(50, '公司名称最多 50 字'),
  jobTitle: z.string().min(1, '职位名称不能为空').max(50, '职位名称最多 50 字'),
  jobUrl: z
    .string()
    .url('链接格式不正确')
    .optional()
    .or(z.literal('')),
  city: z.string().max(30, '城市最多 30 字').optional().or(z.literal('')),
  channel: z.nativeEnum(Channel),
  status: z.nativeEnum(Status),
  salaryRange: z.string().max(30, '薪资范围最多 30 字').optional().or(z.literal('')),
  notes: z.string().max(2000, '备注最多 2000 字').optional().or(z.literal('')),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

/** 状态快速流转：只更新 status 字段 */
export const statusUpdateSchema = z.object({
  status: z.nativeEnum(Status),
});

export type StatusUpdate = z.infer<typeof statusUpdateSchema>;

/** 列表查询参数验证 */
export const applicationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(Status).optional(),
  channel: z.nativeEnum(Channel).optional(),
  keyword: z.string().max(50).optional(),
});

export type ApplicationQuery = z.infer<typeof applicationQuerySchema>;
