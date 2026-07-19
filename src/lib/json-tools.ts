/**
 * JSON 工具集 - 纯函数实现
 *
 * 包含：格式化/压缩、命名风格转换、JSONPath 简易提取、JSON 对比
 * 所有函数纯前端实现，无外部依赖。
 */

// ============================================================
// 1. 格式化 / 压缩
// ============================================================

/** 安全解析 JSON 字符串，失败返回 Error */
export function safeParse(text: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** 格式化（美化）JSON，indent 为缩进空格数 */
export function formatJson(text: string, indent = 2): string {
  const parsed = safeParse(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return JSON.stringify(parsed.data, null, indent);
}

/** 压缩 JSON（无空白） */
export function minifyJson(text: string): string {
  const parsed = safeParse(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return JSON.stringify(parsed.data);
}

/** 转义 JSON 字符串为可嵌入字符串字面量的形式 */
export function escapeJson(text: string): string {
  return JSON.stringify(text).slice(1, -1);
}

// ============================================================
// 2. 命名风格转换（递归转换对象所有 key）
// ============================================================

export type NamingCase = 'camel' | 'snake' | 'kebab' | 'pascal';

/** 拆分字符串为单词数组，支持 camelCase / snake_case / kebab-case / PascalCase / 混合 */
function splitWords(s: string): string[] {
  // 先用分隔符拆分，再处理大小写边界
  const parts = s.split(/[-_\s]+/).filter(Boolean);
  const words: string[] = [];
  for (const part of parts) {
    // 处理 camelCase / PascalCase 边界：abcDef → ['abc', 'Def']
    const matches = part.match(/[A-Z]?[a-z]+|[A-Z]+(?=[A-Z]|$)|\d+/g);
    if (matches) {
      for (const m of matches) words.push(m);
    }
  }
  return words;
}

/** 转换单个 key 到目标风格 */
export function convertKey(key: string, target: NamingCase): string {
  // 数字 key 保持原样
  if (/^\d+$/.test(key)) return key;
  const words = splitWords(key);
  if (words.length === 0) return key;

  switch (target) {
    case 'camel':
      return (
        words[0].toLowerCase() +
        words
          .slice(1)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join('')
      );
    case 'pascal':
      return words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
    case 'snake':
      return words.map((w) => w.toLowerCase()).join('_');
    case 'kebab':
      return words.map((w) => w.toLowerCase()).join('-');
  }
}

export interface ConvertOptions {
  /** 受保护的 key 集合：key 名不改，且其 value 整棵子树内所有 key 都不改名 */
  excludeKeys?: Set<string>;
}

/**
 * 递归转换对象所有 key 名（含嵌套对象和数组元素），仅转 key 名不转 value。
 *
 * 受保护 key（excludeKeys）的处理：
 * - 命中 key 名保持原样
 * - 其 value 整棵子树跳过转换（子树内所有 key 名也保持原样）
 */
export function convertKeysDeep<T>(
  value: T,
  target: NamingCase,
  options: ConvertOptions = {},
): unknown {
  const { excludeKeys } = options;

  if (Array.isArray(value)) {
    return value.map((item) => convertKeysDeep(item, target, options));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const isProtected = excludeKeys?.has(k);
      // 受保护 key：key 名不改，value 子树整体跳过转换
      const newKey = isProtected ? k : convertKey(k, target);
      result[newKey] = isProtected ? v : convertKeysDeep(v, target, options);
    }
    return result;
  }
  return value;
}

/**
 * 统计 JSON 中各 key 名的出现次数（递归，含嵌套对象和数组元素对象的 key）。
 * 用于受保护 key 的命中反馈：告诉用户输入的保护 key 实际命中了几处。
 */
export function countKeyOccurrences(value: unknown): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
    } else if (v !== null && typeof v === 'object') {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        counts.set(k, (counts.get(k) ?? 0) + 1);
        walk(child);
      }
    }
  };
  walk(value);
  return counts;
}

// ============================================================
// 3. JSONPath 简易提取
// ============================================================

/**
 * 简易 JSONPath 求值器
 *
 * 支持语法子集：
 *   $              根
 *   .key           属性访问
 *   ['key']        属性访问（含特殊字符）
 *   [n]            数组索引（支持负数）
 *   .*             通配符（对象所有值 / 数组所有元素）
 *   ..key          递归下降取所有匹配 key
 *   ..[*]          递归下降取所有叶节点
 *
 * 不支持过滤器 ?()、脚本 ()、切片 [start:end]、联合 [a,b]。
 * 复杂需求建议用 jsonpath-plus 库。
 */
export function evalJsonPath(path: string, data: unknown): unknown[] {
  if (!path.startsWith('$')) {
    throw new Error("路径必须以 '$' 开头");
  }

  // 词法分析：拆成段
  type Segment =
    | { type: 'key'; key: string }
    | { type: 'index'; index: number }
    | { type: 'wildcard' }
    | { type: 'recursive-key'; key: string }
    | { type: 'recursive-all' };

  const segments: Segment[] = [];
  let i = 1; // 跳过 $
  const body = path.slice(1);

  // 简化解析：逐字符扫描
  let p = 0;
  while (p < body.length) {
    const ch = body[p];

    if (ch === '.') {
      // 检查是否是 .. 递归
      if (body[p + 1] === '.') {
        p += 2;
        // 后面可能是 * 或 key
        if (body[p] === '*') {
          segments.push({ type: 'recursive-all' });
          p++;
        } else if (body[p] === '[') {
          // ..[*]
          if (body[p + 1] === '*' && body[p + 2] === ']') {
            segments.push({ type: 'recursive-all' });
            p += 3;
          } else {
            throw new Error('递归下降仅支持 ..key 或 ..[*]');
          }
        } else {
          // ..key
          let key = '';
          while (p < body.length && /[\w-]/.test(body[p])) {
            key += body[p];
            p++;
          }
          if (!key) throw new Error('.. 后缺少 key');
          segments.push({ type: 'recursive-key', key });
        }
      } else {
        // .key 或 .*
        p++;
        if (body[p] === '*') {
          segments.push({ type: 'wildcard' });
          p++;
        } else {
          let key = '';
          while (p < body.length && /[\w-]/.test(body[p])) {
            key += body[p];
            p++;
          }
          if (!key) throw new Error('. 后缺少 key');
          segments.push({ type: 'key', key });
        }
      }
    } else if (ch === '[') {
      p++;
      if (body[p] === '*') {
        segments.push({ type: 'wildcard' });
        p += 2; // *]
      } else if (body[p] === "'" || body[p] === '"') {
        const quote = body[p];
        p++;
        let key = '';
        while (p < body.length && body[p] !== quote) {
          key += body[p];
          p++;
        }
        p++; // 闭合引号
        p++; // ]
        segments.push({ type: 'key', key });
      } else {
        let num = '';
        while (p < body.length && /[-\d]/.test(body[p])) {
          num += body[p];
          p++;
        }
        p++; // ]
        segments.push({ type: 'index', index: parseInt(num, 10) });
      }
    } else {
      // 跳过未知字符
      p++;
    }
  }

  // 求值
  let current: unknown[] = [data];
  for (const seg of segments) {
    const next: unknown[] = [];
    for (const item of current) {
      switch (seg.type) {
        case 'key':
          if (item !== null && typeof item === 'object' && seg.key in (item as object)) {
            next.push((item as Record<string, unknown>)[seg.key]);
          }
          break;
        case 'index':
          if (Array.isArray(item)) {
            const idx = seg.index < 0 ? item.length + seg.index : seg.index;
            if (idx >= 0 && idx < item.length) next.push(item[idx]);
          }
          break;
        case 'wildcard':
          if (Array.isArray(item)) {
            next.push(...item);
          } else if (item !== null && typeof item === 'object') {
            next.push(...Object.values(item as Record<string, unknown>));
          }
          break;
        case 'recursive-key': {
          const matches: unknown[] = [];
          const walk = (v: unknown) => {
            if (Array.isArray(v)) {
              for (const x of v) walk(x);
            } else if (v !== null && typeof v === 'object') {
              const obj = v as Record<string, unknown>;
              if (seg.key in obj) matches.push(obj[seg.key]);
              for (const x of Object.values(obj)) walk(x);
            }
          };
          walk(item);
          next.push(...matches);
          break;
        }
        case 'recursive-all': {
          const matches: unknown[] = [];
          const walk = (v: unknown) => {
            matches.push(v);
            if (Array.isArray(v)) {
              for (const x of v) walk(x);
            } else if (v !== null && typeof v === 'object') {
              for (const x of Object.values(v)) walk(x);
            }
          };
          walk(item);
          next.push(...matches);
          break;
        }
      }
    }
    current = next;
  }

  return current;
}

// ============================================================
// 4. JSON 对比（深度 diff）
// ============================================================

export type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface DiffNode {
  /** 完整路径，如 users[0].name */
  path: string;
  type: DiffType;
  /** 仅 type=modified 时有 */
  oldValue?: unknown;
  newValue?: unknown;
  /** 仅 type=added/removed 时有 */
  value?: unknown;
}

/**
 * 深度对比两个 JSON 值，返回差异节点列表
 * 路径格式：$.key / $[0] / $.a[0].b
 */
export function diffJson(oldVal: unknown, newVal: unknown, path = '$'): DiffNode[] {
  const result: DiffNode[] = [];

  // 类型不同 → modified
  if (typeof oldVal !== typeof newVal || Array.isArray(oldVal) !== Array.isArray(newVal)) {
    if (oldVal === undefined) {
      result.push({ path, type: 'added', value: newVal });
    } else if (newVal === undefined) {
      result.push({ path, type: 'removed', value: oldVal });
    } else {
      result.push({ path, type: 'modified', oldValue: oldVal, newValue: newVal });
    }
    return result;
  }

  // 都是数组
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    const maxLen = Math.max(oldVal.length, newVal.length);
    for (let i = 0; i < maxLen; i++) {
      const childPath = `${path}[${i}]`;
      if (i >= oldVal.length) {
        result.push({ path: childPath, type: 'added', value: newVal[i] });
      } else if (i >= newVal.length) {
        result.push({ path: childPath, type: 'removed', value: oldVal[i] });
      } else {
        result.push(...diffJson(oldVal[i], newVal[i], childPath));
      }
    }
    return result;
  }

  // 都是对象
  if (oldVal !== null && newVal !== null && typeof oldVal === 'object' && typeof newVal === 'object') {
    const oldObj = oldVal as Record<string, unknown>;
    const newObj = newVal as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (const key of allKeys) {
      const childPath = `${path}.${key}`;
      if (!(key in oldObj)) {
        result.push({ path: childPath, type: 'added', value: newObj[key] });
      } else if (!(key in newObj)) {
        result.push({ path: childPath, type: 'removed', value: oldObj[key] });
      } else {
        result.push(...diffJson(oldObj[key], newObj[key], childPath));
      }
    }
    return result;
  }

  // 原始值
  if (oldVal !== newVal) {
    result.push({ path, type: 'modified', oldValue: oldVal, newValue: newVal });
  }
  return result;
}

/** 仅返回有变化的节点（过滤 unchanged） */
export function diffJsonChanged(oldVal: unknown, newVal: unknown): DiffNode[] {
  return diffJson(oldVal, newVal).filter((n) => n.type !== 'unchanged');
}

// ============================================================
// 5. 工具函数
// ============================================================

/** 格式化 JS 值为 JSON 字符串（用于展示） */
export function stringify(value: unknown, indent = 2): string {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return String(value);
  }
}

/** 统计 JSON 的一些信息：键数、深度、数组长度等 */
export function jsonStats(text: string): {
  valid: boolean;
  keys?: number;
  depth?: number;
  size?: number;
  error?: string;
} {
  const parsed = safeParse(text);
  if (!parsed.ok) return { valid: false, error: parsed.error };
  let keys = 0;
  let depth = 0;
  const walk = (v: unknown, d: number) => {
    depth = Math.max(depth, d);
    if (Array.isArray(v)) {
      for (const x of v) walk(x, d + 1);
    } else if (v !== null && typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      keys += Object.keys(obj).length;
      for (const x of Object.values(obj)) walk(x, d + 1);
    }
  };
  walk(parsed.data, 0);
  return { valid: true, keys, depth, size: new Blob([text]).size };
}
