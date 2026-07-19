import { describe, it, expect } from 'vitest';

import { envVaultSchema, envVaultUpdateSchema, envVaultImportSchema } from '../envvault';

describe('envVaultSchema', () => {
  it('合法输入通过校验', () => {
    const result = envVaultSchema.safeParse({
      key: 'DATABASE_URL',
      value: 'postgresql://localhost:5432/db',
      tags: ['production', 'db'],
      notes: '主数据库连接',
    });
    expect(result.success).toBe(true);
  });

  it('key 为空被拒', () => {
    const result = envVaultSchema.safeParse({ key: '', value: 'v' });
    expect(result.success).toBe(false);
  });

  it('key 以数字开头被拒', () => {
    const result = envVaultSchema.safeParse({ key: '1KEY', value: 'v' });
    expect(result.success).toBe(false);
  });

  it('key 含特殊字符被拒（仅允许字母数字下划线）', () => {
    const result = envVaultSchema.safeParse({ key: 'KEY-WITH-DASH', value: 'v' });
    expect(result.success).toBe(false);
  });

  it('value 为空被拒', () => {
    const result = envVaultSchema.safeParse({ key: 'K', value: '' });
    expect(result.success).toBe(false);
  });

  it('tags 不传默认为空数组', () => {
    const result = envVaultSchema.safeParse({ key: 'K', value: 'v' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });

  it('tags 超过 10 个被拒', () => {
    const result = envVaultSchema.safeParse({
      key: 'K',
      value: 'v',
      tags: Array(11).fill('tag'),
    });
    expect(result.success).toBe(false);
  });

  it('notes 超过 500 字被拒', () => {
    const result = envVaultSchema.safeParse({
      key: 'K',
      value: 'v',
      notes: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('notes 为空字符串被接受（转 undefined）', () => {
    const result = envVaultSchema.safeParse({ key: 'K', value: 'v', notes: '' });
    expect(result.success).toBe(true);
  });
});

describe('envVaultUpdateSchema', () => {
  it('全部字段可选，空对象通过', () => {
    const result = envVaultUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('只更新 notes 通过', () => {
    const result = envVaultUpdateSchema.safeParse({ notes: '新备注' });
    expect(result.success).toBe(true);
  });
});

describe('envVaultImportSchema', () => {
  it('合法 items 通过', () => {
    const result = envVaultImportSchema.safeParse({
      items: [
        { key: 'KEY1', value: 'val1' },
        { key: 'KEY2', value: 'val2', notes: '备注' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('空 items 被拒', () => {
    const result = envVaultImportSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });

  it('超过 200 条被拒', () => {
    const items = Array(201).fill({ key: 'K', value: 'v' });
    const result = envVaultImportSchema.safeParse({ items });
    expect(result.success).toBe(false);
  });
});
