import { StatsService } from './stats.service';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TopCountriesQueryDto } from './dto/top-countries-query.dto';

describe('geo rankings', () => {
  it('getTopCountries returns ranked {country,value}', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([{ country: 'VN', value: 9n }, { country: 'US', value: 4n }]);
    const svc: any = new StatsService({ $queryRaw } as any);
    const res = await svc.getTopCountries({ metric: 'view', limit: 20 });
    expect(res.data).toEqual([{ rank: 1, country: 'VN', value: 9 }, { rank: 2, country: 'US', value: 4 }]);
  });

  it('getTopCountries accepts a new user-action metric (favorite) and returns shaped rows', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([{ country: 'VN', value: 6n }, { country: 'US', value: 2n }]);
    const svc: any = new StatsService({ $queryRaw } as any);
    const res = await svc.getTopCountries({ metric: 'favorite', limit: 20 });
    expect(res.data).toEqual([{ rank: 1, country: 'VN', value: 6 }, { rank: 2, country: 'US', value: 2 }]);
  });

  it('getTopStoriesByCountry: ranks by raw-SQL result, hydrates story info in SQL order', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ id: 'x', value: 7n }, { id: 'y', value: 3n }]);
    const findMany = jest.fn().mockResolvedValue([
      { id: 'y', title: 'Y', slug: 'y', thumbnailUrl: null },
      { id: 'x', title: 'X', slug: 'x', thumbnailUrl: 't' },
    ]);
    const prisma: any = { $queryRaw: queryRaw, story: { findMany } };
    const svc = new StatsService(prisma);
    const res = await svc.getTopStoriesByCountry({ country: 'VN', metric: 'view', limit: 100 });
    expect(res.data).toEqual([
      { rank: 1, storyId: 'x', title: 'X', slug: 'x', thumbnailUrl: 't', value: 7 },
      { rank: 2, storyId: 'y', title: 'Y', slug: 'y', thumbnailUrl: null, value: 3 },
    ]);
  });

  it('getTopStoriesByCountry: returns empty data without hydrating when no rows', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const findMany = jest.fn();
    const prisma: any = { $queryRaw: queryRaw, story: { findMany } };
    const svc = new StatsService(prisma);
    const res = await svc.getTopStoriesByCountry({ country: 'VN', metric: 'view', limit: 100 });
    expect(res.data).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('getStoryTopCountries returns ranked {country,value}', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([{ country: 'VN', value: 5n }, { country: 'JP', value: 2n }]);
    const svc: any = new StatsService({ $queryRaw } as any);
    const res = await svc.getStoryTopCountries({ storyId: 's1', metric: 'view', limit: 5 });
    expect(res.data).toEqual([{ country: 'VN', value: 5 }, { country: 'JP', value: 2 }]);
  });

  it('getTopCountries trending: decays kind=view buckets and returns shaped rows', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([{ country: 'VN', value: 12 }, { country: 'US', value: 3 }]);
    const svc: any = new StatsService({ $queryRaw } as any);
    const res = await svc.getTopCountries({ metric: 'trending', limit: 20 });
    expect(res.data).toEqual([{ rank: 1, country: 'VN', value: 12 }, { rank: 2, country: 'US', value: 3 }]);
    const sql = $queryRaw.mock.calls[0][0].join(' ');
    expect(sql).toContain('POW(0.9');
    expect(sql).toContain("kind = 'view'");
  });

  it('getTopCountries non-trending: uses SUM(count) with kind param, no decay', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([{ country: 'VN', value: 9n }]);
    const svc: any = new StatsService({ $queryRaw } as any);
    await svc.getTopCountries({ metric: 'view', limit: 20 });
    const sql = $queryRaw.mock.calls[0][0].join(' ');
    expect(sql).not.toContain('POW(0.9');
  });

  it('getStoryTopCountries trending: decays kind=view buckets', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([{ country: 'VN', value: 5 }]);
    const svc: any = new StatsService({ $queryRaw } as any);
    const res = await svc.getStoryTopCountries({ storyId: 's1', metric: 'trending', limit: 5 });
    expect(res.data).toEqual([{ country: 'VN', value: 5 }]);
    const sql = $queryRaw.mock.calls[0][0].join(' ');
    expect(sql).toContain('POW(0.9');
    expect(sql).toContain("kind = 'view'");
  });

  it('getTopStoriesByCountry trending: decays kind=view, hydrates in SQL order', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ id: 'x', value: 7 }, { id: 'y', value: 3 }]);
    const findMany = jest.fn().mockResolvedValue([
      { id: 'y', title: 'Y', slug: 'y', thumbnailUrl: null },
      { id: 'x', title: 'X', slug: 'x', thumbnailUrl: 't' },
    ]);
    const prisma: any = { $queryRaw: queryRaw, story: { findMany } };
    const svc = new StatsService(prisma);
    const res = await svc.getTopStoriesByCountry({ country: 'VN', metric: 'trending', limit: 100 });
    expect(res.data[0]).toEqual({ rank: 1, storyId: 'x', title: 'X', slug: 'x', thumbnailUrl: 't', value: 7 });
    const sql = queryRaw.mock.calls[0][0].join(' ');
    expect(sql).toContain('POW(0.9');
    expect(sql).toContain("scd.kind = 'view'");
  });

  it('TopCountriesQueryDto accepts metric=trending', async () => {
    const dto = plainToInstance(TopCountriesQueryDto, { metric: 'trending', limit: 20 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('TopCountriesQueryDto rejects an unknown metric', async () => {
    const dto = plainToInstance(TopCountriesQueryDto, { metric: 'nope' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
