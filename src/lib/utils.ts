import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 薪资掩码：数字替换为 *，保留单位/分隔符
 * 例: "30-50K·16薪" → "**-**K·**薪"
 */
export function maskSalary(salary: string): string {
  return salary.replace(/\d/g, '*');
}

/**
 * 面试倒计时格式化：
 * - 已过期：返回 "已过期 Nd"（N 天）
 * - 今天：返回 "今天 HH:mm"
 * - 明天：返回 "明天 HH:mm"
 * - 后天：返回 "后天 HH:mm"
 * - 7 天内：返回 "N 天后"
 * - 更远：返回 formatDate
 */
export function formatCountdown(target: Date | string, now: Date = new Date()): string {
  const d = typeof target === 'string' ? new Date(target) : target;
  const diffMs = d.getTime() - now.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTarget = new Date(d);
  startOfTarget.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / oneDayMs
  );

  const hhmm = d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (diffMs < 0) {
    if (dayDiff === 0) return `今天 ${hhmm}（已过）`;
    return `已过期 ${Math.abs(dayDiff)} 天`;
  }
  if (dayDiff === 0) return `今天 ${hhmm}`;
  if (dayDiff === 1) return `明天 ${hhmm}`;
  if (dayDiff === 2) return `后天 ${hhmm}`;
  if (dayDiff <= 7) return `${dayDiff} 天后`;
  return formatDate(d);
}
