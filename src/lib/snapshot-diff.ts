/**
 * 快照对比工具库
 *
 * - 行级 diff：基于 LCS（最长公共子序列）的文本行对比，适用于 text/xml
 * - JSON 深度 diff：复用 json-tools.ts 的 diffJson（已在 JSON 工具模块实现）
 */

export type LineDiffType = 'added' | 'removed' | 'unchanged';

export interface LineDiffItem {
  type: LineDiffType;
  /** 行号（左侧从 1 起，added 时为 null） */
  leftLine: number | null;
  /** 行号（右侧从 1 起，removed 时为 null） */
  rightLine: number | null;
  content: string;
}

/**
 * 基于 LCS 的行级 diff。
 * 时间复杂度 O(n*m)，对几千行以内的快照够用。
 */
export function diffLines(left: string, right: string): LineDiffItem[] {
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  const n = leftLines.length;
  const m = rightLines.length;

  // dp[i][j] = leftLines[0..i) 与 rightLines[0..j) 的 LCS 长度
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (leftLines[i - 1] === rightLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯生成 diff
  const items: LineDiffItem[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      items.unshift({
        type: 'unchanged',
        leftLine: i,
        rightLine: j,
        content: leftLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      items.unshift({
        type: 'added',
        leftLine: null,
        rightLine: j,
        content: rightLines[j - 1],
      });
      j--;
    } else {
      items.unshift({
        type: 'removed',
        leftLine: i,
        rightLine: null,
        content: leftLines[i - 1],
      });
      i--;
    }
  }

  return items;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

/** 统计行级 diff 的增删行数 */
export function computeStats(items: LineDiffItem[]): DiffStats {
  return items.reduce(
    (acc, item) => {
      acc[item.type === 'added' ? 'added' : item.type === 'removed' ? 'removed' : 'unchanged']++;
      return acc;
    },
    { added: 0, removed: 0, unchanged: 0 } as DiffStats,
  );
}

/**
 * 判断字符串是否为合法 JSON（用于自动判断是否走 JSON 深度 diff）
 */
export function isJsonString(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}
