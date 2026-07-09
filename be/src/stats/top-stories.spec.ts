import { StatsService, TopStoryMetric } from './stats.service';

function makeService(storyFindMany: jest.Mock) {
  const prisma: any = { story: { findMany: storyFindMany } };
  return new StatsService(prisma);
}

describe('getTopStories — counter metrics', () => {
  it('reads: orders by totalViews desc, excludes deleted, shapes rank/value', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'a', title: 'A', slug: 'a', thumbnailUrl: null, totalViews: 50n },
      { id: 'b', title: 'B', slug: 'b', thumbnailUrl: 't', totalViews: 10n },
    ]);
    const svc = makeService(findMany);
    const res = await svc.getTopStories({ metric: TopStoryMetric.reads, limit: 100 } as any);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deletedAt: null }),
      orderBy: { totalViews: 'desc' },
      take: 100,
    }));
    expect(res.data).toEqual([
      { rank: 1, storyId: 'a', title: 'A', slug: 'a', thumbnailUrl: null, value: 50 },
      { rank: 2, storyId: 'b', title: 'B', slug: 'b', thumbnailUrl: 't', value: 10 },
    ]);
  });
});

describe('getTopStories — aggregated metrics', () => {
  it('comments: ranks by raw-SQL result, hydrates story info in SQL order', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      { id: 'x', value: 7n }, { id: 'y', value: 3n },
    ]);
    const findMany = jest.fn().mockResolvedValue([
      { id: 'y', title: 'Y', slug: 'y', thumbnailUrl: null },
      { id: 'x', title: 'X', slug: 'x', thumbnailUrl: 't' },
    ]);
    const prisma: any = { $queryRaw: queryRaw, story: { findMany } };
    const { StatsService, TopStoryMetric } = require('./stats.service');
    const svc = new StatsService(prisma);
    const res = await svc.getTopStories({ metric: TopStoryMetric.comments, limit: 100 });
    expect(res.data).toEqual([
      { rank: 1, storyId: 'x', title: 'X', slug: 'x', thumbnailUrl: 't', value: 7 },
      { rank: 2, storyId: 'y', title: 'Y', slug: 'y', thumbnailUrl: null, value: 3 },
    ]);
  });
});
