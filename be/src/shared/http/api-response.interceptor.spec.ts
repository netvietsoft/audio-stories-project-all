import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor';

function makeCtx(requestId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ id: requestId }) }),
  } as unknown as ExecutionContext;
}

function makeNext(value: unknown): CallHandler {
  return { handle: () => of(value) } as CallHandler;
}

async function run(payload: unknown, requestId = 'req-1'): Promise<any> {
  const interceptor = new ApiResponseInterceptor();
  return firstValueFrom(interceptor.intercept(makeCtx(requestId), makeNext(payload)));
}

describe('ApiResponseInterceptor', () => {
  describe('raw payloads → single wrap', () => {
    it('wraps a plain object', async () => {
      const result = await run({ id: 1, title: 'x' });
      expect(result).toEqual({ data: { id: 1, title: 'x' }, meta: { requestId: 'req-1' } });
    });

    it('wraps an array (not treated as an envelope)', async () => {
      const result = await run([1, 2, 3]);
      expect(result).toEqual({ data: [1, 2, 3], meta: { requestId: 'req-1' } });
    });

    it('wraps a primitive', async () => {
      expect(await run('hello')).toEqual({ data: 'hello', meta: { requestId: 'req-1' } });
    });

    it('wraps null', async () => {
      expect(await run(null)).toEqual({ data: null, meta: { requestId: 'req-1' } });
    });

    it('wraps an object that has data but no meta', async () => {
      const result = await run({ data: [1, 2] });
      expect(result).toEqual({ data: { data: [1, 2] }, meta: { requestId: 'req-1' } });
    });
  });

  describe('already-enveloped payloads → no double wrap', () => {
    it('keeps data in place and merges requestId into existing meta', async () => {
      const payload = { data: [{ id: 1 }], meta: { total: 1, page: 1, limit: 20 } };
      const result = await run(payload);
      expect(result).toEqual({
        data: [{ id: 1 }],
        meta: { total: 1, page: 1, limit: 20, requestId: 'req-1' },
      });
      // NOT double-wrapped:
      expect(result.data).toEqual([{ id: 1 }]);
      expect(result.data.data).toBeUndefined();
    });

    it('preserves extra sibling fields alongside data/meta', async () => {
      const payload = {
        data: [{ id: 1 }],
        meta: { total: 1 },
        summary: { revenue: 500 },
      };
      const result = await run(payload);
      expect(result).toEqual({
        data: [{ id: 1 }],
        meta: { total: 1, requestId: 'req-1' },
        summary: { revenue: 500 },
      });
    });

    it('handles an envelope whose data is itself an object', async () => {
      const payload = { data: { comments: [{ id: 9 }] }, meta: { total: 1 } };
      const result = await run(payload);
      expect(result).toEqual({
        data: { comments: [{ id: 9 }] },
        meta: { total: 1, requestId: 'req-1' },
      });
    });

    it('does not flatten when meta is not an object', async () => {
      const payload = { data: [1], meta: 'nope' };
      const result = await run(payload);
      expect(result).toEqual({ data: { data: [1], meta: 'nope' }, meta: { requestId: 'req-1' } });
    });
  });

  it('tolerates an undefined requestId', async () => {
    const interceptor = new ApiResponseInterceptor();
    const result = await firstValueFrom(
      interceptor.intercept(makeCtx(undefined), makeNext({ ok: true })),
    );
    expect(result).toEqual({ data: { ok: true }, meta: { requestId: undefined } });
  });
});
