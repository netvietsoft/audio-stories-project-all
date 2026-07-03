import { Test } from '@nestjs/testing';
import { HealthController } from '../health.controller';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisHealthIndicator } from '../redis-health.indicator';

describe('HealthController', () => {
  let ctrl: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: { check: jest.fn() } },
        { provide: PrismaHealthIndicator, useValue: { pingCheck: jest.fn() } },
        { provide: PrismaService, useValue: {} },
        { provide: RedisHealthIndicator, useValue: { pingCheck: jest.fn() } },
      ],
    }).compile();
    ctrl = moduleRef.get(HealthController);
  });

  it('liveness returns { status: ok }', () => {
    expect(ctrl.liveness()).toEqual({ status: 'ok' });
  });

  it('readiness delegates to terminus with database + redis indicators', async () => {
    const checkResult = { status: 'ok' as const, info: {}, error: {}, details: {} };
    const healthSvc = ctrl['health'] as any;
    healthSvc.check.mockResolvedValue(checkResult);
    const result = await ctrl.readiness();
    expect(result).toBe(checkResult);
    expect(healthSvc.check).toHaveBeenCalledWith(expect.arrayContaining([
      expect.any(Function),
      expect.any(Function),
    ]));
    const [dbCheck, redisCheck] = (healthSvc.check.mock.calls[0] as [Array<() => unknown>])[0];
    dbCheck();
    redisCheck();
    expect((ctrl['prismaIndicator'] as any).pingCheck).toHaveBeenCalledWith(
      'database',
      ctrl['prisma'],
    );
    expect((ctrl['redisIndicator'] as any).pingCheck).toHaveBeenCalledWith('redis');
  });
});
