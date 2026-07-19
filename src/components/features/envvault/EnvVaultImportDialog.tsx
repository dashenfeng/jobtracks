'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface EnvVaultImportDialogProps {
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

interface ParsedItem {
  key: string;
  value: string;
}

/** 解析 .env 文本：按行处理，跳过空行与注释行，按首个 = 分割，去除首尾引号 */
function parseEnvText(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();

    // 去除首尾成对引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!key) continue;
    items.push({ key, value });
  }
  return items;
}

export function EnvVaultImportDialog({ trigger, onSuccess }: EnvVaultImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleParse(rawText: string) {
    setText(rawText);
    setError('');
    setResult(null);
    setItems(parseEnvText(rawText));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleParse(String(reader.result ?? ''));
    };
    reader.onerror = () => setError('文件读取失败');
    reader.readAsText(file);
    // 重置 input 以便重复选择同一文件
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function resetState() {
    setText('');
    setItems([]);
    setError('');
    setResult(null);
    setLoading(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetState();
  }

  async function handleSubmit() {
    if (items.length === 0) {
      setError('没有可导入的条目');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/envvault/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '导入失败');
        setLoading(false);
        return;
      }
      setResult({ created: data.created, skipped: data.skipped });
      onSuccess?.();
      setLoading(false);
    } catch {
      setError('网络错误，请稍后重试');
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>导入 .env</DialogTitle>
          <DialogDescription>
            支持上传 .env 文件或直接粘贴文本，跳过空行与 # 注释行
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              <div className="rounded-md bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
                成功导入 {result.created} 条
                {result.skipped > 0 && `，跳过 ${result.skipped} 条已存在的 key`}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-4" />
                    选择文件
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".env,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <span className="text-xs text-muted-foreground">支持 .env / .txt 文件</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <FileText className="size-4" />
                  或粘贴文本
                </div>
                <Textarea
                  value={text}
                  onChange={(e) => handleParse(e.target.value)}
                  placeholder={'DATABASE_URL=postgres://localhost\nREDIS_URL=redis://localhost\n# 注释行会被跳过'}
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>

              {items.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    预览（共 {items.length} 条，仅显示前 30 字符）
                  </p>
                  <div className="max-h-60 overflow-auto rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-3">键名</TableHead>
                          <TableHead className="pr-3">值</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.key}>
                            <TableCell className="pl-3 font-mono text-xs text-foreground">
                              {item.key}
                            </TableCell>
                            <TableCell className="pr-3 font-mono text-xs text-muted-foreground">
                              {item.value.slice(0, 30)}
                              {item.value.length > 30 ? '…' : ''}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            {result ? '关闭' : '取消'}
          </Button>
          {!result && (
            <Button type="button" onClick={handleSubmit} disabled={loading || items.length === 0}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              导入 {items.length > 0 ? `(${items.length})` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
