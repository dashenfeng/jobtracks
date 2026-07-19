'use client';

import { useMemo, useState } from 'react';
import { Copy, Check, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { convertKeysDeep, countKeyOccurrences, safeParse, type NamingCase } from '@/lib/json-tools';

const CASES: { value: NamingCase; label: string; example: string }[] = [
  { value: 'camel', label: 'camelCase', example: 'userName' },
  { value: 'snake', label: 'snake_case', example: 'user_name' },
  { value: 'kebab', label: 'kebab-case', example: 'user-name' },
  { value: 'pascal', label: 'PascalCase', example: 'UserName' },
];

const SAMPLE = '{"user_name":"alice","user_age":30,"contact_info":{"phone_number":"123","email":"a@b.com"},"items":[{"item_id":1}]}';

/** 解析 exclude 输入：逗号或换行分隔，去重去空 */
function parseExcludeList(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

export function JsonKeyConverter() {
  const [input, setInput] = useState('');
  const [target, setTarget] = useState<NamingCase>('camel');
  const [excludeText, setExcludeText] = useState('');
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => safeParse(input), [input]);
  const excludeList = useMemo(() => parseExcludeList(excludeText), [excludeText]);

  // 统计每个保护 key 在输入 JSON 中的命中次数
  const keyCounts = useMemo(() => {
    if (!parsed.ok) return null;
    return countKeyOccurrences(parsed.data);
  }, [parsed]);
  const hitCount = (k: string) => keyCounts?.get(k) ?? 0;
  const totalHits = excludeList.reduce((sum, k) => sum + hitCount(k), 0);

  const output = useMemo(() => {
    if (!input || !parsed.ok) return '';
    try {
      return JSON.stringify(
        convertKeysDeep(parsed.data, target, {
          excludeKeys: new Set(excludeList),
        }),
        null,
        2,
      );
    } catch {
      return '';
    }
  }, [input, parsed, target, excludeList]);

  async function handleCopy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      {/* 目标风格 */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-foreground">目标风格</span>
        <div className="flex flex-wrap gap-2">
          {CASES.map((c) => (
            <Button
              key={c.value}
              size="sm"
              variant={target === c.value ? 'default' : 'outline'}
              onClick={() => setTarget(c.value)}
              className="gap-2"
            >
              {c.label}
              <span className="font-mono text-xs opacity-70">{c.example}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* exclude 输入 */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Shield className="size-4" />
          受保护 key（该 key 及其子树内所有 key 都不转换）
        </label>
        <Input
          value={excludeText}
          onChange={(e) => setExcludeText(e.target.value)}
          placeholder="如：contact_info, item_id（逗号或换行分隔，可匹配任意层级的 key）"
          className="font-mono text-sm"
        />
        {excludeList.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                共 {excludeList.length} 个保护 key，命中 {totalHits} 处
                {totalHits === 0 && (
                  <span className="ml-1 text-amber-500">（无命中，请检查拼写）</span>
                )}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {excludeList.map((k) => {
                const hits = hitCount(k);
                return (
                  <Badge
                    key={k}
                    variant={hits > 0 ? 'default' : 'outline'}
                    className="gap-1.5 font-mono text-xs"
                  >
                    {k}
                    <span
                      className={
                        hits > 0
                          ? 'rounded bg-primary-foreground/20 px-1 text-[10px]'
                          : 'rounded bg-muted px-1 text-[10px] text-amber-500'
                      }
                    >
                      {hits > 0 ? `${hits} 处` : '未命中'}
                    </span>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setInput(SAMPLE)}>
          加载示例
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 输入区 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">输入</h3>
              {input && (
                <Badge variant={parsed.ok ? 'secondary' : 'destructive'}>
                  {parsed.ok ? '有效' : '错误'}
                </Badge>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setInput('')} disabled={!input}>
              清空
            </Button>
          </div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={SAMPLE}
            className="min-h-[320px] font-mono text-xs"
          />
        </div>

        {/* 输出区 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">输出</h3>
            <Button size="sm" variant="ghost" onClick={handleCopy} disabled={!output}>
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              复制
            </Button>
          </div>
          <Textarea
            value={output}
            readOnly
            placeholder="转换后的 JSON 将显示在这里..."
            className="min-h-[320px] font-mono text-xs"
          />
        </div>
      </div>
    </div>
  );
}
