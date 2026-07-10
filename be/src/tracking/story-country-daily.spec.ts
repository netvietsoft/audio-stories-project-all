import { buildStoryCountryUpsertArgs } from './tracking.service';

describe('buildStoryCountryUpsertArgs', () => {
  it('builds an upsert keyed on (storyId,country,date,kind) incrementing count', () => {
    const day = new Date('2026-07-09T00:00:00.000Z');
    expect(buildStoryCountryUpsertArgs('s1', 'VN', 'view', 3, day)).toEqual({
      where: { storyId_country_date_kind: { storyId: 's1', country: 'VN', date: day, kind: 'view' } },
      create: { storyId: 's1', country: 'VN', date: day, kind: 'view', count: 3 },
      update: { count: { increment: 3 } },
    });
  });
});
