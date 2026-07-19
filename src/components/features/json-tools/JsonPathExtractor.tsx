'use client';

import { useMemo, useState } from 'react';
import { Copy, Check, Search, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { evalJsonPath, safeParse, stringify } from '@/lib/json-tools';

const SAMPLE = `{
  "users": [
    { "id": 1, "name": "alice", "email": "alice@example.com" },
    { "id": 2, "name": "bob", "email": "bob@example.com" }
  ],
  "meta": { "total": 2, "page": 1 }
}`;

const PATH_EXAMPLES = [
  '$.users[0].name',
  '$.users[*].name',
  '$.users[*].email',
  '$..name',
  '$.meta.total',
  '$..[*]',
];

export function JsonPathExtractor() {
  const [input, setInput] = useState('');
  const [path, setPath] = useState('');
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => safeParse(input), [input]);

  const result = useMemo(() => {
    if (!input || !parsed.ok || !path) return null;
    try {
      const matches = evalJsonPath(path, parsed.data);
      return { ok: true as const, matches };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [input, parsed, path]);

  async function handleCopy() {
    if (!result || !result.ok) return;
    await navigator.clipboard.writeText(stringify(result.matches));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      {/* JSON 输入 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">JSON 数据</h3>
            {input && (
              <Badge variant={parsed.ok ? 'secondary' : 'destructive'}>
                {parsed.ok ? '有效' : '错误'}
              </Badge>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setInput(SAMPLE)}>
            加载示例
          </Button>
        </div>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={SAMPLE}
          className="min-h-[200px] font-mono text-xs"
        />
      </div>

      {/* JSONPath 输入 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Search className="size-4" />
          JSONPath 表达式
        </label>
        <Input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="$.users[*].name"
          className="font-mono text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">示例:</span>
          {PATH_EXAMPLES.map((p) => (
            <Button
              key={p}
              size="sm"
              variant="outline"
              className="h-6 px-2 font-mono text-xs"
              onClick={() => setPath(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {/* 结果 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">提取结果</h3>
            {result && result.ok && (
              <Badge variant="secondary">{result.matches.length} 个匹配</Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            disabled={!result || !result.ok || result.matches.length === 0}
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            复制
          </Button>
        </div>

        {result && !result.ok && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span className="break-all">{result.error}</span>
          </div>
        )}

        {result && result.ok && (
          <div className="space-y-2">
            {result.matches.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                没有匹配项
              </div>
            ) : (
              result.matches.map((m, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3"
                >
                  <Badge variant="outline" className="shrink-0 font-mono text-xs">
                    [{i}]
                  </Badge>
                  <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs text-foreground">
                    {stringify(m)}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
