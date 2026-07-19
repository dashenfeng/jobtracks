import type { NextAuthConfig } from 'next-auth';

/**
 * Edge 安全配置（不含 PrismaAdapter / bcrypt / db）
 * 供 proxy.ts（Edge Runtime 中间件）使用，避免 crypto 报错
 */
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  providers: [], // full-config 会补充 Credentials provider
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      // 公开路径：登录、注册、认证 API、静态资源
      const isPublic =
        pathname.startsWith('/login') ||
        pathname.startsWith('/register') ||
        pathname.startsWith('/api/auth');
      if (isPublic) return true;
      // 其余路径需要登录
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
