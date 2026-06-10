import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import * as express from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import {
  collectAllowedOrigins,
  isCorsOriginAllowed,
} from './common/origin.util';

// Patch BigInt so it can be serialized to JSON natively
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Raw body parser for Stripe webhooks
  app.use(
    '/billing/webhook/stripe',
    json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  const allowedOrigins = collectAllowedOrigins(process.env);

  app.enableCors({
    origin: (origin, callback) => {
      if (isCorsOriginAllowed(origin, allowedOrigins, process.env))
        return callback(null, true);
      callback(new Error('CORS not allowed'));
    },
    credentials: true,
  });

  // Serve uploads folder statically at /uploads
  const uploadsPath = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsPath)) {
    mkdirSync(uploadsPath, { recursive: true });
  }

  // Configure express.static with proper MIME types for webp
  app.use(
    '/uploads',
    express.static(uploadsPath, {
      setHeaders: (res, path) => {
        if (path.endsWith('.webp')) {
          res.setHeader('Content-Type', 'image/webp');
        }
      },
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
}
bootstrap();
