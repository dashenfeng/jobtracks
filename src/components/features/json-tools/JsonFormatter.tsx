'use client';

import { useMemo, useState } from 'react';
import { Copy, Minimize2, Maximize2, Check, AlertCircle, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { formatJson, minifyJson, jsonStats, safeParse } from '@/lib/json-tools';

const SAMPLE = `{"name":"jobtracks","version":"1.0.0","dependencies":{"next":"16.2.9","react":"19.2.4"},"scripts":{"dev":"next dev","build":"next build"}}`;

export function JsonFormatter() {
  const [input, setInput] = useState('');
  const [indent, setIndent] = useState(2);
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => safeParse(input), [input]);
  const stats = useMemo(() => (input ? jsonStats(input) : null), [input]);

  const output = useMemo(() => {
    if (!input || !parsed.ok) return '';
    try {
      return formatJson(input, indent);
    } catch {
      return '';
    }
  }, [input, parsed, indent]);

  function handleFormat() {
    if (!parsed.ok) return;
    setInput(formatJson(input, indent));
  }

  function handleMinify() {
    if (!parsed.ok) return;
    setInput(minifyJson(input));
  }

  async function handleCopy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleClear() {
    setInput('');
  }

  function handleLoadSample() {
    setInput(SAMPLE);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 输入区 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">输入</h3>
            {stats && (
              <Badge variant={stats.valid ? 'secondary' : 'destructive'} className="gap-1">
                {stats.valid ? '有效' : '错误'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleLoadSample}>
              示例
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              disabled={!input}
            >
              <Trash2 className="size-3.5" />
              清空
            </Button>
          </div>
        </div>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='{"key":"value","array":[1,2,3]}'
          className="min-h-[360px] font-mono text-xs"
        />
        {input && !parsed.ok && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span className="break-all">{parsed.error}</span>
          </div>
        )}
        {stats && stats.valid && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>键数: {stats.keys ?? 0}</span>
            <span>·</span>
            <span>深度: {stats.depth ?? 0}</span>
            <span>·</span>
            <span>大小: {(stats.size ?? 0)} B</span>
          </div>
        )}
      </div>

      {/* 输出区 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">输出</h3>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">缩进</span>
              {[2, 4].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={indent === n ? 'secondary' : 'ghost'}
                  className="h-6 px-2 text-xs"
                  onClick={() => setIndent(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleFormat} disabled={!parsed.ok}>
              <Maximize2 className="size-3.5" />
              格式化
            </Button>
            <Button size="sm" variant="outline" onClick={handleMinify} disabled={!parsed.ok}>
              <Minimize2 className="size-3.5" />
              压缩
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCopy} disabled={!output}>
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              复制
            </Button>
          </div>
        </div>
        <Textarea
          value={output}
          readOnly
          placeholder="格式化后的 JSON 将显示在这里..."
          className="min-h-[360px] font-mono text-xs"
        />
      </div>
    </div>
  );
}
