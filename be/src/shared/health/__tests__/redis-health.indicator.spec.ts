import { Test } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthIndicator } from '../redis-health.indicator';
import { AppConfigService } from '../../config/app-config.service';

const mockPing = jest.fn();
const mockQuit = jest.fn().mockResolvedValue('OK');

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: mockPing,
    quit: mockQuit,
  }));
});

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;

  beforeEach(async () => {
    mockPing.mockReset();
    mockQuit.mockClear();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        {
          provide: AppConfigService,
          useValue: { redis: { url: 'redis://localhost:6379/0' } },
        },
      ],
    }).compile();
    indicator = moduleRef.get(RedisHealthIndicator);
    indicator.onModuleInit();
  });

  it('returns healthy result on PONG', async () => {
    mockPing.mockResolvedValue('PONG');
    const result = await indicator.pingCheck('redis');
    expect(result).toEqual({ redis: { status: 'up' } });
  });

  it('throws HealthCheckError on non-PONG response', async () => {
    mockPing.mockResolvedValue('something-else');
    await expect(indicator.pingCheck('redis')).rejects.toThrow(HealthCheckError);
  });

  it('throws HealthCheckError on ping rejection', async () => {
    mockPing.mockRejectedValue(new Error('connection refused'));
    await expect(indicator.pingCheck('redis')).rejects.toThrow(HealthCheckError);
  });

  it('quits client on module destroy', async () => {
    await indicator.onModuleDestroy();
    expect(mockQuit).toHaveBeenCalled();
  });
});
