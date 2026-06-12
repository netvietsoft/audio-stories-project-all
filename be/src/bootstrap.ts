import * as fs from 'node:fs';
import { join } from 'node:path';

import { ValidationPipe, type INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import * as express from 'express';

import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import {
  collectAllowedOrigins,
  isCorsOriginAllowed,
} from './common/origin.util';
import {
  getAppRole,
  shouldStartHttpServer,
} from './common/app-role.util';

// Patch BigInt so it can be serialized to JSON natively
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

function configureHttpApp(app: INestApplication, env: NodeJS.ProcessEnv) {
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

  const allowedOrigins = collectAllowedOrigins(env);

  app.enableCors({
    origin: (origin, callback) => {
      if (isCorsOriginAllowed(origin, allowedOrigins, env)) return callback(null, true);
      callback(new Error('CORS not allowed'));
    },
    credentials: true,
  });

  // Serve uploads folder statically at /uploads
  const uploadsPath = join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
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
}

export async function bootstrap(
  env: NodeJS.ProcessEnv = process.env,
  nestFactory: Pick<typeof NestFactory, 'create' | 'createApplicationContext'> = NestFactory,
) {
  const role = getAppRole(env.APP_ROLE);
  Logger.log(`Bootstrapping BE role: ${role}`);

  if (shouldStartHttpServer(role)) {
    const app = await nestFactory.create(AppModule);
    configureHttpApp(app, env);

    const port = Number(env.PORT ?? 3000);
    const host = env.HOST ?? '0.0.0.0';
    await app.listen(port, host);
    Logger.log(`HTTP server listening on http://${host}:${port}`);
    return app;
  }

  const appContext = await nestFactory.createApplicationContext(AppModule);
  Logger.log(`Standalone context ready for role: ${role}`);
  return appContext;
}
