import { AuditAction } from '@prisma/client';

/**
 * 审计日志中文映射（API 和 UI 共用）
 */

/** 动作中文标签 */
export const ACTION_LABELS: Record<AuditAction, string> = {
  VIEW: '查看',
  COPY: '复制',
  CREATE: '创建',
  UPDATE: '更新',
  DELETE: '删除',
  ROTATE: '轮换',
};

/** 目标类型中文标签 */
export const TARGET_TYPE_LABELS: Record<string, string> = {
  EnvVault: '环境变量',
  Snapshot: '快照',
  Changelog: 'Changelog',
  Application: '投递记录',
  Interview: '面试记录',
  InterviewQuestion: '面经题目',
};

/** 目标类型选项（用于下拉筛选） */
export const TARGET_TYPE_OPTIONS = Object.entries(TARGET_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

/** 动作选项（用于下拉筛选） */
export const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(
  ([value, label]) => ({ value: value as AuditAction, label }),
);
