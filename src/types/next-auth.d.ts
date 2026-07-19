import { DefaultSession } from 'next-auth';

/**
 * 扩展 NextAuth 类型，让 session.user 包含 id 字段
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
  }
}
