import { StoriesService } from './stories.service';

function makeService() {
  const prisma: any = { label: { findUnique: jest.fn() } };
  // Only the helpers under test are exercised; other deps unused.
  return new StoriesService(prisma, {} as any, {} as any);
}

describe('story label helpers', () => {
  it('activeLabel: returns mapped label when not expired', () => {
    const s = makeService() as any;
    const future = new Date(Date.now() + 86_400_000);
    const out = s.activeLabel({ labelId: 1, labelExpiresAt: future, label: { id: 1, name: 'Hot', text: 'HOT', color: '#E4572E', textColor: null, icon: null } });
    expect(out).toEqual({ id: 1, name: 'Hot', text: 'HOT', color: '#E4572E', textColor: null, icon: null });
  });

  it('activeLabel: returns null when expired', () => {
    const s = makeService() as any;
    const past = new Date(Date.now() - 86_400_000);
    expect(s.activeLabel({ labelId: 1, labelExpiresAt: past, label: { id: 1 } })).toBeNull();
  });

  it('activeLabel: returns null when no label assigned', () => {
    const s = makeService() as any;
    expect(s.activeLabel({ labelId: null, label: null })).toBeNull();
  });

  it('computeLabelFields: null labelId clears assignment', async () => {
    const s = makeService() as any;
    expect(await s.computeLabelFields(null)).toEqual({ labelId: null, labelAssignedAt: null, labelExpiresAt: null });
  });

  it('computeLabelFields: uses override days for expiry', async () => {
    const s = makeService() as any;
    const r = await s.computeLabelFields(1, 10);
    expect(r.labelId).toBe(1);
    expect(r.labelExpiresAt).toBeInstanceOf(Date);
    const days = (r.labelExpiresAt.getTime() - r.labelAssignedAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(10);
  });

  it('computeLabelFields: 0/null default duration => no expiry', async () => {
    const s = makeService() as any;
    (s.prisma.label.findUnique as jest.Mock).mockResolvedValue({ defaultDurationDays: 0 });
    const r = await s.computeLabelFields(1);
    expect(r.labelExpiresAt).toBeNull();
  });
});
