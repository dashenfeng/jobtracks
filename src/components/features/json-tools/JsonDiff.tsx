'use client';

import { useMemo, useState } from 'react';
import { Plus, Minus, Pencil, ArrowRight, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { diffJsonChanged, safeParse, stringify, type DiffNode } from '@/lib/json-tools';

const SAMPLE_A = `{
  "name": "jobtracks",
  "version": "1.0.0",
  "author": "alice",
  "tags": ["next", "react"],
  "config": { "port": 3000, "debug": true }
}`;

const SAMPLE_B = `{
  "name": "jobtracks",
  "version": "1.1.0",
  "author": "bob",
  "license": "MIT",
  "tags": ["next", "react", "prisma"],
  "config": { "port": 3000, "debug": false, "host": "0.0.0.0" }
}`;

function DiffRow({ node }: { node: DiffNode }) {
  const iconMap = {
    added: <Plus className="size-3.5 text-emerald-500" />,
    removed: <Minus className="size-3.5 text-destructive" />,
    modified: <Pencil className="size-3.5 text-amber-500" />,
    unchanged: null,
  };

  const labelMap = {
    added: { text: '新增', variant: 'secondary' as const },
    removed: { text: '删除', variant: 'destructive' as const },
    modified: { text: '修改', variant: 'default' as const },
    unchanged: { text: '', variant: 'secondary' as const },
  };

  const label = labelMap[node.type];

  return (
    <div className="flex items-start gap-3 border-b border-border px-3 py-2 last:border-0">
      <div className="mt-0.5 shrink-0">{iconMap[node.type]}</div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-mono text-xs text-foreground">{node.path}</code>
          <Badge variant={label.variant} className="text-[10px]">
            {label.text}
          </Badge>
        </div>
        {node.type === 'modified' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <code className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-destructive line-through">
              {stringify(node.oldValue)}
            </code>
            <ArrowRight className="size-3 text-muted-foreground" />
            <code className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-emerald-600 dark:text-emerald-400">
              {stringify(node.newValue)}
            </code>
          </div>
        )}
        {node.type === 'added' && (
          <code className="block rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-xs text-emerald-600 dark:text-emerald-400">
            {stringify(node.value)}
          </code>
        )}
        {node.type === 'removed' && (
          <code className="block rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-xs text-destructive line-through">
            {stringify(node.value)}
          </code>
        )}
      </div>
    </div>
  );
}

export function JsonDiff() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');

  const leftParsed = useMemo(() => safeParse(left), [left]);
  const rightParsed = useMemo(() => safeParse(right), [right]);

  const diffs = useMemo<DiffNode[]>(() => {
    if (!leftParsed.ok || !rightParsed.ok) return [];
    return diffJsonChanged(leftParsed.data, rightParsed.data);
  }, [leftParsed, rightParsed]);

  const stats = useMemo(() => {
    return {
      added: diffs.filter((d) => d.type === 'added').length,
      removed: diffs.filter((d) => d.type === 'removed').length,
      modified: diffs.filter((d) => d.type === 'modified').length,
    };
  }, [diffs]);

  const canDiff = leftParsed.ok && rightParsed.ok && (left || right);

  function loadSamples() {
    setLeft(SAMPLE_A);
    setRight(SAMPLE_B);
  }

  function clearAll() {
    setLeft('');
    setRight('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={loadSamples}>
          加载示例
        </Button>
        <Button size="sm" variant="ghost" onClick={clearAll} disabled={!left && !right}>
          <Trash2 className="size-3.5" />
          清空
        </Button>
      </div>

      {/* 双栏输入 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">原始 JSON</h3>
            {left && (
              <Badge variant={leftParsed.ok ? 'secondary' : 'destructive'}>
                {leftParsed.ok ? '有效' : '错误'}
              </Badge>
            )}
          </div>
          <Textarea
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            placeholder={SAMPLE_A}
            className="min-h-[240px] font-mono text-xs"
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">对比 JSON</h3>
            {right && (
              <Badge variant={rightParsed.ok ? 'secondary' : 'destructive'}>
                {rightParsed.ok ? '有效' : '错误'}
              </Badge>
            )}
          </div>
          <Textarea
            value={right}
            onChange={(e) => setRight(e.target.value)}
            placeholder={SAMPLE_B}
            className="min-h-[240px] font-mono text-xs"
          />
        </div>
      </div>

      {/* 差异结果 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">差异</h3>
          {canDiff && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-600 dark:text-emerald-400">+ {stats.added}</span>
              <span className="text-destructive">- {stats.removed}</span>
              <span className="text-amber-500">~ {stats.modified}</span>
            </div>
          )}
        </div>

        {diffs.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {canDiff ? '两个 JSON 完全相同，无差异' : '请输入两个有效的 JSON 后开始对比'}
          </div>
        ) : (
          <div className="rounded-md border border-border">
            {diffs.map((d, i) => (
              <DiffRow key={`${d.path}-${i}`} node={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
