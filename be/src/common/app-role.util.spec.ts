import {
  buildScheduleImports,
  getAppRole,
  shouldEnableScheduler,
  shouldStartHttpServer,
} from './app-role.util';

jest.mock('@nestjs/schedule', () => ({
  ScheduleModule: {
    forRoot: jest.fn(() => ({ module: 'ScheduleModule' })),
  },
}));

describe('app-role.util', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults missing APP_ROLE to api', () => {
    expect(getAppRole(undefined)).toBe('api');
    expect(getAppRole('')).toBe('api');
    expect(getAppRole('   ')).toBe('api');
  });

  it.each(['api', 'worker', 'scheduler'] as const)(
    'accepts explicit role %s',
    (role) => {
      expect(getAppRole(role)).toBe(role);
    },
  );

  it('throws on invalid APP_ROLE values', () => {
    expect(() => getAppRole('cron-runner')).toThrow(
      'Invalid APP_ROLE "cron-runner". Expected one of: api, worker, scheduler.',
    );
  });

  it('keeps api-only and scheduler-only invariants explicit', () => {
    expect(shouldStartHttpServer('api')).toBe(true);
    expect(shouldStartHttpServer('worker')).toBe(false);
    expect(shouldStartHttpServer('scheduler')).toBe(false);

    expect(shouldEnableScheduler('api')).toBe(false);
    expect(shouldEnableScheduler('worker')).toBe(false);
    expect(shouldEnableScheduler('scheduler')).toBe(true);
  });

  it('enables schedule imports only for scheduler role', () => {
    const { ScheduleModule } = jest.requireMock('@nestjs/schedule') as {
      ScheduleModule: { forRoot: jest.Mock };
    };

    expect(buildScheduleImports({ APP_ROLE: 'api' })).toEqual([]);
    expect(buildScheduleImports({ APP_ROLE: 'worker' })).toEqual([]);
    expect(buildScheduleImports({ APP_ROLE: 'scheduler' })).toEqual([
      { module: 'ScheduleModule' },
    ]);
    expect(ScheduleModule.forRoot).toHaveBeenCalledTimes(1);
  });
});
