/**
 * CSV 序列化工具
 *
 * - 符合 RFC 4180
 * - 字段含逗号 / 双引号 / 换行 / 回车时，用双引号包裹，内部双引号转义为两个双引号
 * - 不依赖第三方库
 */

/** 转义单个 CSV 字段 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  // 含逗号、双引号、换行、回车时需要加引号
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** 将二维数组序列化为 CSV 字符串 */
export function toCsv(rows: (unknown[])[]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
}

/**
 * 构造带 UTF-8 BOM 的 CSV 内容（Excel 兼容）
 *
 * Excel 在打开无 BOM 的 UTF-8 CSV 时会把中文显示为乱码，
 * 加上 BOM（\uFEFF）可以确保正确识别编码。
 */
export function toCsvWithBom(rows: (unknown[])[]): string {
  return '\uFEFF' + toCsv(rows);
}
