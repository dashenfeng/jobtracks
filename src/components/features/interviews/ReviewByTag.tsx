'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Interview,
  InterviewQuestion,
  Application,
  QuestionPerformance,
} from '@prisma/client';
import {
  Inbox,
  Loader2,
  ChevronDown,
  ChevronRight,
  Tag as TagIcon,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DIFFICULTY_MAP, PERFORMANCE_MAP } from '@/lib/constants/interviews';
import { formatDateTime } from '@/lib/utils';

type ReviewItem = InterviewQuestion & {
  interview: Pick<Interview, 'id' | 'round' | 'scheduledAt'> & {
    application: Pick<Application, 'id' | 'companyName' | 'jobTitle'>;
  };
};

const PERFORMANCE_FILTER_OPTIONS = [
  { value: 'POOR_OKAY', label: '答得差 + 一般（默认）' },
  { value: 'POOR', label: '仅答得差' },
  { value: 'OKAY', label: '仅一般' },
  { value: 'GOOD', label: '仅答得好' },
  { value: 'ALL', label: '全部' },
];

const DIFFICULTY_FILTER_OPTIONS = [
  { value: 'ALL', label: '全部难度' },
  { value: 'EASY', label: '简单' },
  { value: 'MEDIUM', label: '中等' },
  { value: 'HARD', label: '困难' },
];

interface TagGroup {
  tag: string;
  items: ReviewItem[];
  poorCount: number;
  okayCount: number;
  goodCount: number;
}

export function ReviewByTag() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [performance, setPerformance] = useState('POOR_OKAY');
  const [difficulty, setDifficulty] = useState('ALL');
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('performance', performance);
      params.set('difficulty', difficulty);
      const res = await fetch(`/api/review?${params}`);
      if (!res.ok) throw new Error('加载失败');
      setItems(await res.json());
    } catch {
      setError('加载失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  }, [performance, difficulty]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 按 tag 聚合
  const groups: TagGroup[] = useMemo(() => {
    const map = new Map<string, ReviewItem[]>();
    for (const item of items) {
      if (item.tags.length === 0) {
        const key = '未分类';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      } else {
        for (const tag of item.tags) {
          if (!map.has(tag)) map.set(tag, []);
          map.get(tag)!.push(item);
        }
      }
    }
    const result: TagGroup[] = [];
    for (const [tag, groupItems] of map.entries()) {
      result.push({
        tag,
        items: groupItems,
        poorCount: groupItems.filter((i) => i.performance === QuestionPerformance.POOR).length,
        okayCount: groupItems.filter((i) => i.performance === QuestionPerformance.OKAY).length,
        goodCount: groupItems.filter((i) => i.performance === QuestionPerformance.GOOD).length,
      });
    }
    // 按题目数倒序
    result.sort((a, b) => b.items.length - a.items.length);
    return result;
  }, [items]);

  const toggleTag = (tag: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* 筛选区 */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={performance} onValueChange={setPerformance}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="表现" />
          </SelectTrigger>
          <SelectContent>
            {PERFORMANCE_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={difficulty} onValueChange={setDifficulty}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="难度" />
          </SelectTrigger>
          <SelectContent>
            {DIFFICULTY_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          共 {items.length} 题 · {groups.length} 个知识点
        </span>
      </div>

      {/* 列表 */}
      {error ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            加载中...
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">还没有可复盘的题目</p>
              <p className="mt-1 text-sm text-muted-foreground">
                在面试详情里记录题目并标记表现后，这里会自动按知识点聚合
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expandedTags.has(group.tag);
            return (
              <Card key={group.tag}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() => toggleTag(group.tag)}
                    className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                      <TagIcon className="size-4 text-primary" />
                      <span className="font-medium text-foreground">{group.tag}</span>
                      <Badge variant="secondary">{group.items.length} 题</Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {group.poorCount > 0 && (
                        <Badge variant="destructive">{group.poorCount} 差</Badge>
                      )}
                      {group.okayCount > 0 && (
                        <Badge variant="outline">{group.okayCount} 一般</Badge>
                      )}
                      {group.goodCount > 0 && (
                        <Badge variant="default">{group.goodCount} 好</Badge>
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="divide-y divide-border border-t border-border">
                      {group.items.map((item) => {
                        const diffConfig = DIFFICULTY_MAP[item.difficulty];
                        const perfConfig = PERFORMANCE_MAP[item.performance];
                        return (
                          <div key={item.id} className="space-y-3 p-5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{item.question}</p>
                                <Link
                                  href={`/interviews/${item.interview.id}`}
                                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                >
                                  {item.interview.application.companyName}
                                  {item.interview.application.jobTitle
                                    ? ` · ${item.interview.application.jobTitle}`
                                    : ''}
                                  {' · 第 '}
                                  {item.interview.round}
                                  {' 轮 · '}
                                  {formatDateTime(item.interview.scheduledAt)}
                                </Link>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge variant={diffConfig.badge}>{diffConfig.label}</Badge>
                                <Badge variant={perfConfig.badge}>{perfConfig.label}</Badge>
                              </div>
                            </div>
                            {item.myAnswer && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">我的回答</p>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                  {item.myAnswer}
                                </p>
                              </div>
                            )}
                            {item.referenceAnswer && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">参考答案</p>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                  {item.referenceAnswer}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
