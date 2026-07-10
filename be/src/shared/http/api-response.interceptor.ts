import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiSuccess } from './api-response';

/**
 * Wraps every handler result in the standard envelope `{ data, meta: { requestId } }`.
 *
 * Idempotent: a handler that already returns an envelope (paginated list
 * services return `{ data, meta }`) is NOT double-wrapped. Its `data` is kept
 * in place, `requestId` is merged into the existing `meta`, and any extra
 * sibling fields (e.g. a `summary`) are preserved. This keeps the response
 * contract consistent — clients always read the payload at `res.data`.
 */
@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  intercept(ctx: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    const req = ctx.switchToHttp().getRequest<{ id?: string }>();
    return next.handle().pipe(
      map((payload) => {
        if (isEnvelope(payload)) {
          return {
            ...payload,
            meta: { ...payload.meta, requestId: req.id },
          } as ApiSuccess<T>;
        }
        return { data: payload, meta: { requestId: req.id } };
      }),
    );
  }
}

/** True when a payload already looks like `{ data, meta }` (meta an object). */
function isEnvelope(
  value: unknown,
): value is { data: unknown; meta: Record<string, unknown> } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    'data' in obj &&
    'meta' in obj &&
    obj.meta !== null &&
    typeof obj.meta === 'object' &&
    !Array.isArray(obj.meta)
  );
}
