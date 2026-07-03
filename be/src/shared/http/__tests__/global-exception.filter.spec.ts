import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from '../global-exception.filter';
import { DomainError } from '../../kernel/domain-error';

class StoryNotFound extends DomainError {
  readonly code = 'STORY_NOT_FOUND';
  readonly httpStatus = 404;
}

function buildHost(req: any) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const ctx = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;
  return { host: ctx, status, json };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let logger: jest.Mocked<Logger>;

  beforeEach(() => {
    logger = { error: jest.fn(), warn: jest.fn() } as unknown as jest.Mocked<Logger>;
    filter = new GlobalExceptionFilter(logger);
  });

  it('maps DomainError to its httpStatus with code', () => {
    const { host, status, json } = buildHost({ id: 'req-1', method: 'GET', url: '/x' });
    filter.catch(new StoryNotFound('not found'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'STORY_NOT_FOUND', message: 'not found' },
      meta: { requestId: 'req-1' },
    });
  });

  it('maps HttpException to its status', () => {
    const { host, status, json } = buildHost({ id: 'req-2', method: 'POST', url: '/y' });
    filter.catch(new HttpException('bad', HttpStatus.BAD_REQUEST), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'bad' }),
      }),
    );
  });

  it('maps Prisma P2002 to 409 conflict', () => {
    const { host, status, json } = buildHost({ id: 'req-3', method: 'POST', url: '/z' });
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6' } as any);
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'UNIQUE_CONSTRAINT_VIOLATION' }) }),
    );
  });

  it('maps unknown error to 500 INTERNAL', () => {
    const { host, status, json } = buildHost({ id: 'req-4', method: 'GET', url: '/q' });
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INTERNAL_ERROR' }) }),
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
