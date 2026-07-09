import { buildDailyViewUpsertArgs } from './tracking.service';

describe('buildDailyViewUpsertArgs', () => {
  it('builds an upsert keyed on (storyId, day) that increments views', () => {
    const day = new Date('2026-07-09T00:00:00.000Z');
    const args = buildDailyViewUpsertArgs('story-1', 5, day);
    expect(args).toEqual({
      where: { storyId_date: { storyId: 'story-1', date: day } },
      create: { storyId: 'story-1', date: day, views: 5 },
      update: { views: { increment: 5 } },
    });
  });
});
