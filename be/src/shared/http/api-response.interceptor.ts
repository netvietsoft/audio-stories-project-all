import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiSuccess } from './api-response';

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  intercept(ctx: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    const req = ctx.switchToHttp().getRequest<{ id?: string }>();
    return next.handle().pipe(
      map((data) => ({
        data,
        meta: { requestId: req.id },
      })),
    );
  }
}
