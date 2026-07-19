import { z } from 'zod';

/**
 * Snapshot 相关常量与 Zod schema
 */

/** 支持的内容类型 */
export const SNAPSHOT_CONTENT_TYPES = ['json', 'xml', 'text'] as const;
export type SnapshotContentType = (typeof SNAPSHOT_CONTENT_TYPES)[number];

/** 单条快照内容最大长度 */
export const CONTENT_MAX_LENGTH = 100_000;

/** 创建快照 schema */
export const snapshotSchema = z.object({
  name: z.string().trim().min(1, '名称不能为空').max(100, '名称最多 100 字'),
  content: z
    .string()
    .trim()
    .min(1, '内容不能为空')
    .max(CONTENT_MAX_LENGTH, '内容过长，最多 100,000 字符'),
  contentType: z.enum(SNAPSHOT_CONTENT_TYPES, {
    message: '内容类型仅支持 json / xml / text',
  }),
  remarks: z.string().trim().max(500, '备注最多 500 字').optional().or(z.literal('')),
  tags: z.array(z.string().trim().min(1).max(20)).max(10, '最多 10 个标签').default([]),
  project: z.string().trim().max(100, '项目名最多 100 字').optional().or(z.literal('')),
  isBaseline: z.boolean().default(false),
  baselineId: z.string().optional().nullable(),
});

/** 部分更新 schema */
export const snapshotUpdateSchema = snapshotSchema.partial();

/** 导出类型 */
export type SnapshotInput = z.infer<typeof snapshotSchema>;
export type SnapshotUpdateInput = z.infer<typeof snapshotUpdateSchema>;
