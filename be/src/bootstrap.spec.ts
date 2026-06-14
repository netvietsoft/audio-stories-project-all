jest.mock('node:fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

jest.mock('./app.module', () => ({
  AppModule: class AppModuleMock {},
}));

import { bootstrap } from './bootstrap';

function createHttpAppDouble() {
  return {
    use: jest.fn(),
    useGlobalPipes: jest.fn(),
    useGlobalFilters: jest.fn(),
    enableCors: jest.fn(),
    listen: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockReturnValue({}),
    useLogger: jest.fn(),
  };
}

describe('bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('boots api role as HTTP app and listens on configured host/port', async () => {
    const httpApp = createHttpAppDouble();
    const nestFactory = {
      create: jest.fn().mockResolvedValue(httpApp),
      createApplicationContext: jest.fn(),
    } as any;

    await bootstrap(
      {
        APP_ROLE: 'api',
        PORT: '4321',
        HOST: '127.0.0.1',
        NODE_ENV: 'development',
      } as NodeJS.ProcessEnv,
      nestFactory,
    );

    expect(nestFactory.create).toHaveBeenCalledTimes(1);
    expect(nestFactory.createApplicationContext).not.toHaveBeenCalled();
    expect(httpApp.enableCors).toHaveBeenCalledTimes(1);
    expect(httpApp.listen).toHaveBeenCalledWith(4321, '127.0.0.1');
  });

  it.each(['worker', 'scheduler'] as const)(
    'boots %s role as standalone application context without HTTP listen',
    async (role) => {
      const appContext = {
        close: jest.fn(),
        get: jest.fn().mockReturnValue({}),
        useLogger: jest.fn(),
      };
      const nestFactory = {
        create: jest.fn(),
        createApplicationContext: jest.fn().mockResolvedValue(appContext),
      } as any;

      await bootstrap(
        {
          APP_ROLE: role,
          NODE_ENV: 'development',
        } as NodeJS.ProcessEnv,
        nestFactory,
      );

      expect(nestFactory.create).not.toHaveBeenCalled();
      expect(nestFactory.createApplicationContext).toHaveBeenCalledTimes(1);
    },
  );
});
