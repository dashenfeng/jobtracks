import { z } from 'zod';

/**
 * Changelog 相关常量与 Zod schema
 */

/** 变更类型：新功能 / 修复 / 优化 / 破坏性 */
export const CHANGE_TYPES = ['NEW', 'FIX', 'IMPROVED', 'BREAKING'] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

/** 单条变更描述最大长度 */
export const CHANGE_DESCRIPTION_MAX = 500;

/** 版本号最大长度（如 v1.2.0） */
export const VERSION_MAX = 50;

/** 单个 Changelog 最多变更条数 */
export const CHANGES_MAX_COUNT = 50;

/** 截图 URL 最大数量 */
export const SCREENSHOTS_MAX = 10;

/** 单条变更 schema */
export const changeSchema = z.object({
  id: z.string().optional(),
  type: z.enum(CHANGE_TYPES, { message: '变更类型必须是 NEW/FIX/IMPROVED/BREAKING' }),
  description: z
    .string()
    .trim()
    .min(1, '变更描述不能为空')
    .max(CHANGE_DESCRIPTION_MAX, `变更描述最多 ${CHANGE_DESCRIPTION_MAX} 字`),
});

/** 创建 Changelog schema */
export const changelogSchema = z.object({
  version: z
    .string()
    .trim()
    .min(1, '版本号不能为空')
    .max(VERSION_MAX, `版本号最多 ${VERSION_MAX} 字`),
  releasedAt: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: '发布日期格式无效',
  }),
  screenshots: z
    .array(z.string().trim().url('截图必须是合法 URL'))
    .max(SCREENSHOTS_MAX, `最多 ${SCREENSHOTS_MAX} 张截图`)
    .default([]),
  changes: z
    .array(changeSchema)
    .min(1, '至少需要一条变更记录')
    .max(CHANGES_MAX_COUNT, `最多 ${CHANGES_MAX_COUNT} 条变更记录`),
});

/** 更新 schema（所有字段可选；changes 整体替换） */
export const changelogUpdateSchema = z.object({
  version: z.string().trim().min(1).max(VERSION_MAX).optional(),
  releasedAt: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: '发布日期格式无效' })
    .optional(),
  screenshots: z
    .array(z.string().trim().url())
    .max(SCREENSHOTS_MAX)
    .optional(),
  changes: z.array(changeSchema).min(1).max(CHANGES_MAX_COUNT).optional(),
});

/** 查询参数 schema */
export const changelogQuerySchema = z.object({
  q: z.string().trim().optional(),
  type: z.enum(CHANGE_TYPES).optional(),
});

/** 导出类型 */
export type ChangelogInput = z.infer<typeof changelogSchema>;
export type ChangelogUpdateInput = z.infer<typeof changelogUpdateSchema>;
export type ChangeInput = z.infer<typeof changeSchema>;
