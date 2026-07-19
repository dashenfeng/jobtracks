import { describe, it, expect } from 'vitest';
import { formatCountdown, formatDate, maskSalary } from '@/lib/utils';

describe('formatCountdown', () => {
  // 固定"现在"为 2026-07-04 10:00:00
  const now = new Date(2026, 6, 4, 10, 0, 0);

  it('已过期（昨天）返回"已过期 N 天"', () => {
    const past = new Date(2026, 6, 3, 14, 0);
    expect(formatCountdown(past, now)).toBe('已过期 1 天');
  });

  it('今天未来时间返回"今天 HH:mm"', () => {
    const today = new Date(2026, 6, 4, 15, 30);
    expect(formatCountdown(today, now)).toBe('今天 15:30');
  });

  it('今天已过时间返回"今天 HH:mm（已过）"', () => {
    const todayPast = new Date(2026, 6, 4, 8, 0);
    expect(formatCountdown(todayPast, now)).toBe('今天 08:00（已过）');
  });

  it('明天返回"明天 HH:mm"', () => {
    const tomorrow = new Date(2026, 6, 5, 14, 0);
    expect(formatCountdown(tomorrow, now)).toBe('明天 14:00');
  });

  it('后天返回"后天 HH:mm"', () => {
    const dayAfter = new Date(2026, 6, 6, 9, 15);
    expect(formatCountdown(dayAfter, now)).toBe('后天 09:15');
  });

  it('3-7 天内返回"N 天后"', () => {
    const inFiveDays = new Date(2026, 6, 9, 11, 0);
    expect(formatCountdown(inFiveDays, now)).toBe('5 天后');
  });

  it('超过 7 天返回 formatDate 结果', () => {
    const far = new Date(2026, 7, 15, 10, 0);
    expect(formatCountdown(far, now)).toBe(formatDate(far));
  });
});

describe('maskSalary', () => {
  it('数字替换为 *', () => {
    expect(maskSalary('30-50K')).toBe('**-**K');
  });

  it('保留中文单位', () => {
    expect(maskSalary('30-50K·16薪')).toBe('**-**K·**薪');
  });

  it('无数字时原样返回', () => {
    expect(maskSalary('面议')).toBe('面议');
  });
});
