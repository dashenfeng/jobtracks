import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
        >
          <Sparkles size={20} />
        </div>
        <div className="text-left">
          <h1 className="text-base font-semibold leading-none text-foreground">职迹</h1>
          <p className="mt-1.5 text-xs leading-none text-muted-foreground">个人求职工作台</p>
        </div>
      </Link>
      {children}
    </div>
  );
}
