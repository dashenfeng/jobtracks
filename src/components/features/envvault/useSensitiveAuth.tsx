'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock } from 'lucide-react';

const STORAGE_KEY = 'envault:verify-token';
const STORAGE_EXP_KEY = 'envault:verify-exp';

/**
 * 敏感操作二次认证 Hook
 *
 * - token 存 sessionStorage，刷新页面不丢失，关闭标签页即清空
 * - 5 分钟有效期，过期自动清除
 * - ensureVerified(): 若已认证且未过期，立即 resolve；否则弹出密码框
 */
export function useSensitiveAuth() {
  const [pendingResolver, setPendingResolver] = useState<
    ((ok: boolean) => void) | null
  >(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 从 storage 读取 token
  const getStoredToken = useCallback((): { token: string; exp: number } | null => {
    if (typeof window === 'undefined') return null;
    const token = sessionStorage.getItem(STORAGE_KEY);
    const expStr = sessionStorage.getItem(STORAGE_EXP_KEY);
    if (!token || !expStr) return null;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() >= exp * 1000) {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_EXP_KEY);
      return null;
    }
    return { token, exp };
  }, []);

  // 设置定时器在过期时清除
  const scheduleExpiryCleanup = useCallback((exp: number) => {
    if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    const ms = exp * 1000 - Date.now();
    if (ms > 0) {
      cleanupTimerRef.current = setTimeout(() => {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_EXP_KEY);
      }, ms);
    }
  }, []);

  // 卸载时清理定时器
  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    };
  }, []);

  // 提交密码
  const submitPassword = useCallback(async () => {
    if (!password) {
      setError('请输入密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '验证失败');
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, data.token);
      sessionStorage.setItem(STORAGE_EXP_KEY, String(data.exp));
      scheduleExpiryCleanup(data.exp);
      setPassword('');
      pendingResolver?.(true);
      setPendingResolver(null);
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [password, pendingResolver, scheduleExpiryCleanup]);

  // 取消
  const cancel = useCallback(() => {
    setPassword('');
    setError('');
    pendingResolver?.(false);
    setPendingResolver(null);
  }, [pendingResolver]);

  // 供业务调用：确保已认证
  const ensureVerified = useCallback(async (): Promise<string | null> => {
    const stored = getStoredToken();
    if (stored) return stored.token;
    return new Promise<string | null>((resolve) => {
      setPendingResolver(() => (ok: boolean) => {
        if (ok) {
          const t = sessionStorage.getItem(STORAGE_KEY);
          resolve(t);
        } else {
          resolve(null);
        }
      });
    });
  }, [getStoredToken]);

  // 获取当前 token（不弹窗）
  const getToken = useCallback((): string | null => {
    return getStoredToken()?.token ?? null;
  }, [getStoredToken]);

  // 清除 token（如服务端返回 401）
  const clearToken = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_EXP_KEY);
  }, []);

  const dialog = (
    <Dialog open={!!pendingResolver} onOpenChange={(o) => !o && cancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-4" />
            敏感操作验证
          </DialogTitle>
          <DialogDescription>
            为保护环境变量安全，请重新输入登录密码以继续
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="verify-password">登录密码</Label>
          <Input
            id="verify-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) submitPassword();
            }}
            autoFocus
            disabled={loading}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={cancel} disabled={loading}>
            取消
          </Button>
          <Button onClick={submitPassword} disabled={loading || !password}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            验证
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { ensureVerified, getToken, clearToken, dialog };
}
