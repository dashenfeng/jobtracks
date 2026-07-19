'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  GitCompare,
  Loader2,
  Plus,
  Minus,
  Equal,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { diffJson, diffJsonChanged, safeParse, type DiffNode } from '@/lib/json-tools';
import {
  diffLines,
  computeStats,
  isJsonString,
  type LineDiffItem,
} from '@/lib/snapshot-diff';
import { formatDateTime } from '@/lib/utils';

interface SnapshotData {
  id: string;
  name: string;
  content: string;
  contentType: string;
  project: string | null;
  createdAt: string;
}

export function SnapshotDiffClient() {
  const searchParams = useSearchParams();
  const leftId = searchParams.get('a');
  const rightId = searchParams.get('b');

  const [left, setLeft] = useState<SnapshotData | null>(null);
  const [right, setRight] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!leftId || !rightId) {
      setError('请从快照列表选择两个快照进行对比');
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/snapshots/diff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leftId, rightId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || '加载失败');
          return;
        }
        setLeft(data.left);
        setRight(data.right);
      } catch {
        setError('网络错误，请稍后重试');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [leftId, rightId]);

  // 判断是否两边都是 JSON，决定走 JSON 深度 diff 还是行级 diff
  const bothJson = useMemo(() => {
    if (!left || !right) return false;
    return (
      (left.contentType === 'json' || isJsonString(left.content)) &&
      (right.contentType === 'json' || isJsonString(right.content))
    );
  }, [left, right]);

  const jsonDiffResult = useMemo<{ nodes: DiffNode[]; changed: DiffNode[] } | null>(() => {
    if (!bothJson || !left || !right) return null;
    const leftParsed = safeParse(left.content);
    const rightParsed = safeParse(right.content);
    if (!leftParsed.ok || !rightParsed.ok) return null;
    const nodes = diffJson(leftParsed.data, rightParsed.data);
    return {
      nodes,
      changed: nodes.filter((n) => n.type !== 'unchanged'),
    };
  }, [bothJson, left, right]);

  const lineDiffResult = useMemo<{ items: LineDiffItem[]; stats: { added: number; removed: number; unchanged: number } } | null>(() => {
    if (!left || !right) return null;
    const items = diffLines(left.content, right.content);
    return { items, stats: computeStats(items) };
  }, [left, right]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-16 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        加载对比数据...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {error}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/tools/snapshots">
            <ArrowLeft className="size-4" />
            返回快照列表
          </Link>
        </Button>
      </div>
    );
  }

  if (!left || !right) return null;

  return (
    <div className="space-y-6">
      {/* 头部：两个快照元信息 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline" className="font-mono text-xs">
                A
              </Badge>
              <span className="truncate">{left.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <div>类型：{left.contentType.toUpperCase()}</div>
            <div>项目：{left.project || '-'}</div>
            <div>创建：{formatDateTime(left.createdAt)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline" className="font-mono text-xs">
                B
              </Badge>
              <span className="truncate">{right.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <div>类型：{right.contentType.toUpperCase()}</div>
            <div>项目：{right.project || '-'}</div>
            <div>创建：{formatDateTime(right.createdAt)}</div>
          </CardContent>
        </Card>
      </div>

      {/* 统计概览 */}
      {bothJson && jsonDiffResult ? (
        <DiffStatsBar
          added={jsonDiffResult.changed.filter((n) => n.type === 'added').length}
          removed={jsonDiffResult.changed.filter((n) => n.type === 'removed').length}
          modified={jsonDiffResult.changed.filter((n) => n.type === 'modified').length}
          mode="json"
        />
      ) : lineDiffResult ? (
        <DiffStatsBar
          added={lineDiffResult.stats.added}
          removed={lineDiffResult.stats.removed}
          modified={0}
          mode="line"
        />
      ) : null}

      {/* 对比视图 */}
      {bothJson && jsonDiffResult ? (
        <Tabs defaultValue="diff">
          <TabsList>
            <TabsTrigger value="diff">差异视图</TabsTrigger>
            <TabsTrigger value="raw">原始内容</TabsTrigger>
          </TabsList>
          <TabsContent value="diff" className="mt-4">
            <JsonDiffView nodes={jsonDiffResult.changed} />
          </TabsContent>
          <TabsContent value="raw" className="mt-4">
            <RawSideBySide left={left.content} right={right.content} />
          </TabsContent>
        </Tabs>
      ) : lineDiffResult ? (
        <Tabs defaultValue="diff">
          <TabsList>
            <TabsTrigger value="diff">差异视图</TabsTrigger>
            <TabsTrigger value="raw">原始内容</TabsTrigger>
          </TabsList>
          <TabsContent value="diff" className="mt-4">
            <LineDiffView items={lineDiffResult.items} />
          </TabsContent>
          <TabsContent value="raw" className="mt-4">
            <RawSideBySide left={left.content} right={right.content} />
          </TabsContent>
        </Tabs>
      ) : null}

      {/* 返回按钮 */}
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/tools/snapshots">
            <ArrowLeft className="size-4" />
            返回快照列表
          </Link>
        </Button>
      </div>
    </div>
  );
}

function DiffStatsBar({
  added,
  removed,
  modified,
  mode,
}: {
  added: number;
  removed: number;
  modified: number;
  mode: 'json' | 'line';
}) {
  return (
    <div className="flex items-center gap-4 rounded-md border border-border bg-muted/30 px-4 py-2 text-sm">
      <span className="font-medium text-foreground">
        {mode === 'json' ? 'JSON 深度对比' : '行级对比'}
      </span>
      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <Plus className="size-4" />
        新增 {added}
      </span>
      <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
        <Minus className="size-4" />
        删除 {removed}
      </span>
      {modified > 0 && (
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <AlertCircle className="size-4" />
          修改 {modified}
        </span>
      )}
    </div>
  );
}

function JsonDiffView({ nodes }: { nodes: DiffNode[] }) {
  if (nodes.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border p-8 text-sm text-muted-foreground">
        <Equal className="size-4 text-emerald-500" />
        两个快照内容完全一致
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="grid grid-cols-12 gap-0 font-mono text-xs">
        {nodes.map((node, idx) => {
          const bgClass =
            node.type === 'added'
              ? 'bg-emerald-500/10'
              : node.type === 'removed'
                ? 'bg-red-500/10'
                : 'bg-amber-500/10';
          const textClass =
            node.type === 'added'
              ? 'text-emerald-700 dark:text-emerald-300'
              : node.type === 'removed'
                ? 'text-red-700 dark:text-red-300'
                : 'text-amber-700 dark:text-amber-300';
          const label =
            node.type === 'added' ? '+' : node.type === 'removed' ? '-' : '~';
          return (
            <div
              key={`${node.path}-${idx}`}
              className={`col-span-12 grid grid-cols-12 gap-0 border-b border-border/50 ${bgClass}`}
            >
              <div className={`col-span-1 px-2 py-1 ${textClass}`}>{label}</div>
              <div className="col-span-3 truncate px-1 py-1 text-muted-foreground">
                {node.path}
              </div>
              <div className="col-span-8 break-all px-1 py-1">
                <span className={textClass}>
                  {node.type === 'removed'
                    ? formatValue(node.oldValue)
                    : formatValue(node.newValue)}
                  {node.type === 'modified' && (
                    <span className="ml-2 text-muted-foreground line-through">
                      {formatValue(node.oldValue)}
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function LineDiffView({ items }: { items: LineDiffItem[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="grid grid-cols-12 gap-0 font-mono text-xs">
        {items.map((item, idx) => {
          const bgClass =
            item.type === 'added'
              ? 'bg-emerald-500/10'
              : item.type === 'removed'
                ? 'bg-red-500/10'
                : '';
          const textClass =
            item.type === 'added'
              ? 'text-emerald-700 dark:text-emerald-300'
              : item.type === 'removed'
                ? 'text-red-700 dark:text-red-300'
                : 'text-foreground';
          const label =
            item.type === 'added' ? '+' : item.type === 'removed' ? '-' : ' ';
          return (
            <div
              key={idx}
              className={`col-span-12 grid grid-cols-12 gap-0 border-b border-border/50 ${bgClass}`}
            >
              <div className={`col-span-1 px-2 py-1 ${textClass}`}>{label}</div>
              <div className="col-span-1 px-1 py-1 text-muted-foreground">
                {item.leftLine ?? ''}
              </div>
              <div className="col-span-1 px-1 py-1 text-muted-foreground">
                {item.rightLine ?? ''}
              </div>
              <div className={`col-span-9 break-all px-2 py-1 ${textClass}`}>
                {item.content || ' '}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RawSideBySide({ left, right }: { left: string; right: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="font-mono text-xs">A</Badge>
            左侧
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[480px] overflow-auto rounded-md bg-muted/30 p-3 text-xs">
            {left}
          </pre>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="font-mono text-xs">B</Badge>
            右侧
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[480px] overflow-auto rounded-md bg-muted/30 p-3 text-xs">
            {right}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
