import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { Response, Request } from 'express';
import { DomainError } from '../kernel/domain-error';
import { ApiError } from './api-response';

const PRISMA_MAP: Record<string, { status: number; code: string; message: string }> = {
  P1001: { status: 503, code: 'DATABASE_UNAVAILABLE', message: 'Database is temporarily unavailable.' },
  P2002: { status: 409, code: 'UNIQUE_CONSTRAINT_VIOLATION', message: 'Resource already exists.' },
  P2025: { status: 404, code: 'RECORD_NOT_FOUND', message: 'Record not found.' },
  P2022: { status: 500, code: 'SCHEMA_MISMATCH', message: 'Database schema is out of sync.' },
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = req.id;

    if (exception instanceof DomainError) {
      const body: ApiError = {
        error: { code: exception.code, message: exception.message },
        meta: { requestId },
      };
      res.status(exception.httpStatus).json(body);
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_MAP[exception.code] ?? { status: 500, code: `PRISMA_${exception.code}`, message: 'Database request failed.' };
      this.logger.error({ err: exception, requestId }, `Prisma error ${exception.code} at ${req.method} ${req.url}`);
      res.status(mapped.status).json({
        error: { code: mapped.code, message: mapped.message },
        meta: { requestId },
      } satisfies ApiError);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse();
      const message = typeof r === 'string' ? r : (r as any).message ?? exception.message;
      const code = (r as any)?.code ?? this.statusToCode(status);
      const details = typeof r === 'object' ? (r as any).details : undefined;
      res.status(status).json({
        error: { code, message: Array.isArray(message) ? message.join(', ') : message, details },
        meta: { requestId },
      } satisfies ApiError);
      return;
    }

    this.logger.error({ err: exception, requestId }, `Unhandled error at ${req.method} ${req.url}`);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' },
      meta: { requestId },
    } satisfies ApiError);
  }

  private statusToCode(status: number): string {
    if (status === 400) return 'BAD_REQUEST';
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'CONFLICT';
    if (status === 422) return 'UNPROCESSABLE_ENTITY';
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500) return 'INTERNAL_ERROR';
    return 'ERROR';
  }
}
