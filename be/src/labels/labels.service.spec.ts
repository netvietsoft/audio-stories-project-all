import { LabelsService } from './labels.service';

const db = { label: {} as any };
const prisma = db as any;

describe('LabelsService', () => {
  let service: LabelsService;
  beforeEach(() => { service = new LabelsService(prisma); });

  it('findAll returns {data, meta} with pagination', async () => {
    db.label.count = jest.fn().mockResolvedValue(2);
    db.label.findMany = jest.fn().mockResolvedValue([
      { id: 1, name: 'Hot', text: 'HOT', color: '#E4572E' },
      { id: 2, name: 'New', text: 'NEW', color: '#2E86E4' },
    ]);
    const res = await service.findAll({ page: 1, limit: 20 } as any);
    expect(res.data).toHaveLength(2);
    expect(res.meta).toEqual({ total: 2, page: 1, lastPage: 1 });
  });

  it('create passes fields through to prisma', async () => {
    db.label.create = jest.fn().mockResolvedValue({ id: 3 });
    await service.create({ name: 'Editor', text: "Editor's Choice", color: '#7C3AED', defaultDurationDays: 0 } as any);
    expect(db.label.create).toHaveBeenCalledWith({
      data: { name: 'Editor', text: "Editor's Choice", color: '#7C3AED', textColor: undefined, icon: undefined, defaultDurationDays: 0 },
    });
  });

  it('findOne throws NotFound when missing', async () => {
    db.label.findUnique = jest.fn().mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toThrow('99');
  });
});
