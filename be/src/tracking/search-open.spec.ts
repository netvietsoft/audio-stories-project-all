import { TrackingService } from './tracking.service';
jest.mock('@/common/geo/geo.util', () => ({ resolveCountry: () => 'VN', clientIp: () => '8.8.8.8' }));

function makeService() {
  const redis: any = { set: jest.fn().mockResolvedValue('OK'), incr: jest.fn().mockResolvedValue(1) };
  const prisma: any = { story: { findFirst: jest.fn().mockResolvedValue({ id: 'real-id' }) } };
  const svc: any = new TrackingService(prisma, { get: () => undefined } as any);
  svc.redis = redis; svc.redisEnabled = true;
  return { svc, redis, prisma };
}

describe('trackSearchOpen', () => {
  it('resolves slug->id, dedups, increments geo search counter', async () => {
    const { svc, redis, prisma } = makeService();
    await svc.trackSearchOpen({ storyId: 'my-slug', deviceId: 'device-123456' }, '8.8.8.8');
    expect(prisma.story.findFirst).toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith('track:search:real-id:device-123456', '1', 'EX', 3600, 'NX');
    expect(redis.incr).toHaveBeenCalledWith('story:geo:search:real-id:VN');
  });
});
