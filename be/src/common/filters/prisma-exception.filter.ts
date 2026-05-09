import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception.code === 'P1001') {
      this.logger.error(`Database unreachable for ${request.method} ${request.url}`);

      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: 'Database is temporarily unavailable. Please try again in a moment.',
      });
      return;
    }

    if (exception.code === 'P2022') {
      const target = (exception.meta?.column as string | undefined) || 'unknown column';
      this.logger.error(`Database schema mismatch (${target}) at ${request.method} ${request.url}`);

      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Database schema is out of sync with application code.',
      });
      return;
    }

    this.logger.error(`Unhandled Prisma error ${exception.code} at ${request.method} ${request.url}`);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Database request failed.',
    });
  }
}
