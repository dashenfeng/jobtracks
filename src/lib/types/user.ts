/**
 * 用户偏好设置类型
 * 存储在 User.preferences Json 字段
 */
export interface UserPreferences {
  /** 薪资字段是否启用掩码（默认 true） */
  salaryMaskEnabled?: boolean;
}

/** 默认偏好（数据库 preferences 为 null 时用） */
export const DEFAULT_PREFERENCES: UserPreferences = {
  salaryMaskEnabled: true,
};

/** 合并用户偏好与默认值（确保字段完整） */
export function mergePreferences(prefs: unknown): UserPreferences {
  if (!prefs || typeof prefs !== 'object') return { ...DEFAULT_PREFERENCES };
  return { ...DEFAULT_PREFERENCES, ...(prefs as Partial<UserPreferences>) };
}
