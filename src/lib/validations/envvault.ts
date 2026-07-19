import { z } from 'zod';

/**
 * EnvVault 相关常量与 Zod schema
 */

/** value 掩码字符（列表/详情默认显示） */
export const MASKED_VALUE = '••••••••';

/** 单次 .env 导入条目上限，防止超大文件拖垮请求 */
export const IMPORT_MAX_ENTRIES = 200;

/** 单条 value 最大长度（加密前明文） */
export const VALUE_MAX_LENGTH = 10_000;

/** 创建/更新 EnvVault 的 schema */
export const envVaultSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, '键名不能为空')
    .max(100, '键名最多 100 字')
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, '键名只能包含字母、数字、下划线，且不能以数字开头'),
  value: z.string().trim().min(1, '值不能为空').max(VALUE_MAX_LENGTH, '值过长'),
  tags: z.array(z.string().trim().min(1).max(20)).max(10, '最多 10 个标签').default([]),
  notes: z.string().trim().max(500, '备注最多 500 字').optional().or(z.literal('')),
});

/** 部分更新 schema（value 可选） */
export const envVaultUpdateSchema = envVaultSchema.partial();

/** .env 导入 schema：接受 { items: [{key, value, notes?}] } */
export const envVaultImportSchema = z.object({
  items: z
    .array(
      z.object({
        key: envVaultSchema.shape.key,
        value: envVaultSchema.shape.value,
        notes: z.string().trim().max(500).optional().or(z.literal('')),
      }),
    )
    .min(1, '至少导入 1 条')
    .max(IMPORT_MAX_ENTRIES, `单次最多导入 ${IMPORT_MAX_ENTRIES} 条`),
});

/** 导出类型 */
export type EnvVaultInput = z.infer<typeof envVaultSchema>;
export type EnvVaultUpdateInput = z.infer<typeof envVaultUpdateSchema>;
export type EnvVaultImportInput = z.infer<typeof envVaultImportSchema>;
