import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  InterviewStatus: {
    SCHEDULED: 'SCHEDULED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  },
  InterviewType: {
    VIDEO: 'VIDEO',
    PHONE: 'PHONE',
    ONSITE: 'ONSITE',
  },
  QuestionDifficulty: {
    EASY: 'EASY',
    MEDIUM: 'MEDIUM',
    HARD: 'HARD',
  },
  QuestionPerformance: {
    GOOD: 'GOOD',
    OKAY: 'OKAY',
    POOR: 'POOR',
  },
}));

vi.mock('@/lib/auth/full-config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    interview: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    interviewQuestion: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/interviews/route';
import { GET as getId, PATCH, DELETE } from '@/app/api/interviews/[id]/route';
import {
  GET as getQuestions,
  POST as postQuestion,
} from '@/app/api/interviews/[id]/questions/route';
import { GET as getReview } from '@/app/api/review/route';
import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';

const mockedAuth = vi.mocked(auth);
const mockedInterviewFindMany = vi.mocked(prisma.interview.findMany);
const mockedInterviewFindFirst = vi.mocked(prisma.interview.findFirst);
const mockedInterviewUpdate = vi.mocked(prisma.interview.update);
const mockedInterviewDelete = vi.mocked(prisma.interview.delete);
const mockedQuestionFindMany = vi.mocked(prisma.interviewQuestion.findMany);
const mockedQuestionCreate = vi.mocked(prisma.interviewQuestion.create);

const ORIGIN = 'http://localhost:3000';
const HOST = 'localhost:3000';

function makeGetRequest(query = ''): Request {
  return new Request(`http://localhost:3000/api/interviews${query}`, {
    method: 'GET',
    headers: { host: HOST },
  });
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/interviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it('已登录返回面试列表', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindMany.mockResolvedValueOnce([
      { id: 'i1', application: { companyName: 'ACME', jobTitle: '前端' } },
    ] as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(mockedInterviewFindMany).toHaveBeenCalledOnce();
    // 验证 where 含 userId
    const args = mockedInterviewFindMany.mock.calls[0]![0]! as any;
    expect(args.where).toMatchObject({ userId: 'u1' });
    expect(args.orderBy).toEqual({ scheduledAt: 'desc' });
  });

  it('非法 status 返回 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await GET(makeGetRequest('?status=INVALID'));
    expect(res.status).toBe(400);
  });

  it('合法 status 筛选 SCHEDULED → 查询条件含 status', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindMany.mockResolvedValueOnce([] as never);

    await GET(makeGetRequest('?status=SCHEDULED'));

    const args = mockedInterviewFindMany.mock.calls[0]![0]! as any;
    expect(args.where).toMatchObject({ userId: 'u1', status: 'SCHEDULED' });
  });

  it('from/to 时间范围筛选', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindMany.mockResolvedValueOnce([] as never);

    await GET(makeGetRequest('?from=2026-01-01&to=2026-12-31'));

    const args = mockedInterviewFindMany.mock.calls[0]![0]! as any;
    expect(args.where.scheduledAt).toBeDefined();
    expect(args.where.scheduledAt.gte).toBeInstanceOf(Date);
    expect(args.where.scheduledAt.lte).toBeInstanceOf(Date);
  });
});

describe('GET /api/interviews/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await getId(makeGetRequest(), makeContext('i1'));
    expect(res.status).toBe(401);
  });

  it('面试不存在或非本人 → 404', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindFirst.mockResolvedValueOnce(null as never);

    const res = await getId(makeGetRequest(), makeContext('i1'));
    expect(res.status).toBe(404);
  });

  it('面试存在 → 返回详情（含 application + questions）', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const interview = {
      id: 'i1',
      round: 1,
      type: 'VIDEO',
      application: { id: 'a1', companyName: 'ACME', jobTitle: '前端' },
      questions: [],
    };
    mockedInterviewFindFirst.mockResolvedValueOnce(interview as never);

    const res = await getId(makeGetRequest(), makeContext('i1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('i1');
    // 验证查询时按 userId 隔离
    const args = mockedInterviewFindFirst.mock.calls[0]![0]! as any;
    expect(args.where).toMatchObject({ id: 'i1', userId: 'u1' });
  });
});

describe('PATCH /api/interviews/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('缺少 Origin 返回 403（CSRF）', async () => {
    const req = new Request('http://localhost:3000/api/interviews/i1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', host: HOST },
      body: JSON.stringify({ round: 1, type: 'VIDEO', scheduledAt: '2026-01-01' }),
    });
    const res = await PATCH(req, makeContext('i1'));
    expect(res.status).toBe(403);
    expect(mockedAuth).not.toHaveBeenCalled();
  });

  it('面试不存在 → 404', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindFirst.mockResolvedValueOnce(null as never);

    const req = new Request('http://localhost:3000/api/interviews/i1', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        origin: ORIGIN,
        host: HOST,
      },
      body: JSON.stringify({
        round: 1,
        type: 'VIDEO',
        scheduledAt: '2026-01-01',
      }),
    });
    const res = await PATCH(req, makeContext('i1'));
    expect(res.status).toBe(404);
  });

  it('非法 round（0）→ 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindFirst.mockResolvedValueOnce({ id: 'i1' } as never);

    const req = new Request('http://localhost:3000/api/interviews/i1', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        origin: ORIGIN,
        host: HOST,
      },
      body: JSON.stringify({
        round: 0,
        type: 'VIDEO',
        scheduledAt: '2026-01-01',
      }),
    });
    const res = await PATCH(req, makeContext('i1'));
    expect(res.status).toBe(400);
  });

  it('合法更新 → 200', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindFirst.mockResolvedValueOnce({ id: 'i1' } as never);
    mockedInterviewUpdate.mockResolvedValueOnce({ id: 'i1', round: 2 } as never);

    const req = new Request('http://localhost:3000/api/interviews/i1', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        origin: ORIGIN,
        host: HOST,
      },
      body: JSON.stringify({
        round: 2,
        type: 'VIDEO',
        scheduledAt: '2026-01-01',
      }),
    });
    const res = await PATCH(req, makeContext('i1'));
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/interviews/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('缺少 Origin 返回 403', async () => {
    const req = new Request('http://localhost:3000/api/interviews/i1', {
      method: 'DELETE',
      headers: { host: HOST },
    });
    const res = await DELETE(req, makeContext('i1'));
    expect(res.status).toBe(403);
  });

  it('面试不存在 → 404', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindFirst.mockResolvedValueOnce(null as never);

    const req = new Request('http://localhost:3000/api/interviews/i1', {
      method: 'DELETE',
      headers: { origin: ORIGIN, host: HOST },
    });
    const res = await DELETE(req, makeContext('i1'));
    expect(res.status).toBe(404);
  });

  it('删除成功 → 200', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindFirst.mockResolvedValueOnce({ id: 'i1' } as never);
    mockedInterviewDelete.mockResolvedValueOnce({ id: 'i1' } as never);

    const req = new Request('http://localhost:3000/api/interviews/i1', {
      method: 'DELETE',
      headers: { origin: ORIGIN, host: HOST },
    });
    const res = await DELETE(req, makeContext('i1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('GET /api/interviews/[id]/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await getQuestions(makeGetRequest(), makeContext('i1'));
    expect(res.status).toBe(401);
  });

  it('面试不存在 → 404', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindFirst.mockResolvedValueOnce(null as never);

    const res = await getQuestions(makeGetRequest(), makeContext('i1'));
    expect(res.status).toBe(404);
  });

  it('返回题目列表（按 createdAt 正序）', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindFirst.mockResolvedValueOnce({ id: 'i1' } as never);
    mockedQuestionFindMany.mockResolvedValueOnce([
      { id: 'q1', question: '自我介绍' },
    ] as never);

    const res = await getQuestions(makeGetRequest(), makeContext('i1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    // 验证按 createdAt asc
    const args = mockedQuestionFindMany.mock.calls[0]![0]! as any;
    expect(args.orderBy).toEqual({ createdAt: 'asc' });
  });
});

describe('POST /api/interviews/[id]/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('缺少 Origin 返回 403', async () => {
    const req = new Request('http://localhost:3000/api/interviews/i1/questions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: HOST },
      body: JSON.stringify({ question: 'Q', difficulty: 'EASY', performance: 'GOOD' }),
    });
    const res = await postQuestion(req, makeContext('i1'));
    expect(res.status).toBe(403);
  });

  it('面试不存在 → 404', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindFirst.mockResolvedValueOnce(null as never);

    const req = new Request('http://localhost:3000/api/interviews/i1/questions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ORIGIN,
        host: HOST,
      },
      body: JSON.stringify({
        question: 'Q',
        difficulty: 'EASY',
        performance: 'GOOD',
      }),
    });
    const res = await postQuestion(req, makeContext('i1'));
    expect(res.status).toBe(404);
  });

  it('question 为空 → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindFirst.mockResolvedValueOnce({ id: 'i1' } as never);

    const req = new Request('http://localhost:3000/api/interviews/i1/questions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ORIGIN,
        host: HOST,
      },
      body: JSON.stringify({
        question: '',
        difficulty: 'EASY',
        performance: 'GOOD',
      }),
    });
    const res = await postQuestion(req, makeContext('i1'));
    expect(res.status).toBe(400);
  });

  it('合法创建 → 200', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedInterviewFindFirst.mockResolvedValueOnce({ id: 'i1' } as never);
    mockedQuestionCreate.mockResolvedValueOnce({ id: 'q1' } as never);

    const req = new Request('http://localhost:3000/api/interviews/i1/questions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ORIGIN,
        host: HOST,
      },
      body: JSON.stringify({
        question: '请自我介绍',
        difficulty: 'EASY',
        performance: 'GOOD',
      }),
    });
    const res = await postQuestion(req, makeContext('i1'));
    expect(res.status).toBe(200);
    // 验证 create 时带 interviewId 和 userId
    const args = mockedQuestionCreate.mock.calls[0]![0]! as any;
    expect(args.data).toMatchObject({
      interviewId: 'i1',
      userId: 'u1',
    });
  });
});

describe('GET /api/review (错题本)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录返回 401', async () => {
    mockedAuth.mockResolvedValueOnce(null as never);
    const res = await getReview(
      new Request('http://localhost:3000/api/review', {
        method: 'GET',
        headers: { host: HOST },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('默认 performance=POOR_OKAY 查询', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedQuestionFindMany.mockResolvedValueOnce([] as never);

    await getReview(
      new Request('http://localhost:3000/api/review', {
        method: 'GET',
        headers: { host: HOST },
      }),
    );

    const args = mockedQuestionFindMany.mock.calls[0]![0]! as any;
    expect(args.where).toMatchObject({
      userId: 'u1',
      performance: { in: ['POOR', 'OKAY'] },
    });
  });

  it('performance=ALL 不加筛选', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedQuestionFindMany.mockResolvedValueOnce([] as never);

    await getReview(
      new Request('http://localhost:3000/api/review?performance=ALL', {
        method: 'GET',
        headers: { host: HOST },
      }),
    );

    const args = mockedQuestionFindMany.mock.calls[0]![0]! as any;
    expect(args.where).toMatchObject({ userId: 'u1' });
    expect(args.where.performance).toBeUndefined();
  });

  it('非法 performance → 400', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const res = await getReview(
      new Request('http://localhost:3000/api/review?performance=INVALID', {
        method: 'GET',
        headers: { host: HOST },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('合法 difficulty 筛选', async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    mockedQuestionFindMany.mockResolvedValueOnce([] as never);

    await getReview(
      new Request('http://localhost:3000/api/review?difficulty=HARD', {
        method: 'GET',
        headers: { host: HOST },
      }),
    );

    const args = mockedQuestionFindMany.mock.calls[0]![0]! as any;
    expect(args.where.difficulty).toBe('HARD');
  });
});
