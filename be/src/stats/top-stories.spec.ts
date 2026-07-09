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
