// 查询/创建测试用户
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// 手动读取 .env 文件
const envPath = resolve(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf-8');
console.log('env 第一行:', envContent.split('\n')[0]);

for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) {
    let val = match[2];
    // 去除首尾引号
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    process.env[match[1]] = val;
  }
}

console.log('DATABASE_URL:', process.env.DATABASE_URL);

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    let user = await prisma.user.findUnique({
      where: { email: 'test@jobtracks.dev' },
    });

    if (!user) {
      const hashed = await bcrypt.hash('test123456', 10);
      user = await prisma.user.create({
        data: {
          email: 'test@jobtracks.dev',
          password: hashed,
          name: 'Test User',
        },
      });
      console.log('创建测试用户成功:', user.id);
    } else {
      const hashed = await bcrypt.hash('test123456', 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed },
      });
      console.log('已重置测试用户密码:', user.id);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
