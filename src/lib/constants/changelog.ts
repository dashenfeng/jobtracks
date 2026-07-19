import { ChangeType } from '@prisma/client';

/**
 * Changelog 变更类型中文映射 + Badge 样式
 *
 * - NEW：新功能（蓝色 default）
 * - FIX：修复（绿色 outline）
 * - IMPROVED：优化（青色 secondary）
 * - BREAKING：破坏性变更（红色 destructive）
 */
export const CHANGE_TYPE_MAP: Record<
  ChangeType,
  { label: string; badge: 'default' | 'secondary' | 'destructive' | 'outline'; icon: string }
> = {
  NEW: { label: '新功能', badge: 'default', icon: '✨' },
  FIX: { label: '修复', badge: 'outline', icon: '🐛' },
  IMPROVED: { label: '优化', badge: 'secondary', icon: '⚡' },
  BREAKING: { label: '破坏性', badge: 'destructive', icon: '💥' },
};

/** 变更类型选项（用于 Select 下拉） */
export const CHANGE_TYPE_OPTIONS = Object.entries(CHANGE_TYPE_MAP).map(
  ([value, { label }]) => ({
    value: value as ChangeType,
    label,
  }),
);
