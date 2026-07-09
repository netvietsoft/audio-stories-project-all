jest.mock('./geo.util', () => ({ resolveCountry: (ip?: string) => (ip === '8.8.8.8' ? 'VN' : null) }));
import { GeoService } from './geo.service';

function make() { const upsert = jest.fn(); return { svc: new GeoService({ storyCountryDaily: { upsert } } as any), upsert }; }

describe('GeoService.record', () => {
  it('upserts increment when country resolves', async () => {
    const { svc, upsert } = make();
    await svc.record('s1', '8.8.8.8', 'favorite', 1);
    expect(upsert).toHaveBeenCalledTimes(1);
    const args = upsert.mock.calls[0][0];
    expect(args.where.storyId_country_date_kind).toMatchObject({ storyId: 's1', country: 'VN', kind: 'favorite' });
    expect(args.create).toMatchObject({ storyId: 's1', country: 'VN', kind: 'favorite', count: 1 });
    expect(args.update).toEqual({ count: { increment: 1 } });
  });
  it('no-op when country unresolvable', async () => {
    const { svc, upsert } = make();
    await svc.record('s1', '127.0.0.1', 'favorite', 1);
    expect(upsert).not.toHaveBeenCalled();
  });
  it('no-op when value <= 0', async () => {
    const { svc, upsert } = make();
    await svc.record('s1', '8.8.8.8', 'gift', 0);
    expect(upsert).not.toHaveBeenCalled();
  });
  it('swallows upsert errors (fire-and-forget)', async () => {
    const upsert = jest.fn().mockRejectedValue(new Error('db down'));
    const svc = new GeoService({ storyCountryDaily: { upsert } } as any);
    await expect(svc.record('s1', '8.8.8.8', 'gift', 5)).resolves.toBeUndefined();
  });
});
