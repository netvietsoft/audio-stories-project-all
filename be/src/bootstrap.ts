import * as fs from 'node:fs';
import { join } from 'node:path';

import { ValidationPipe, type INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import * as express from 'express';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module';
import {
  collectAllowedOrigins,
  isCorsOriginAllowed,
} from './common/origin.util';
import {
  getAppRole,
  shouldStartHttpServer,
} from './common/app-role.util';
import { GlobalExceptionFilter } from './shared/http/global-exception.filter';
import { ApiResponseInterceptor } from './shared/http/api-response.interceptor';

// Patch BigInt so it can be serialized to JSON natively
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Audio Stories BE')
    .setDescription('REST API for the Audio Stories platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('refresh_token')
    .build();
  return SwaggerModule.createDocument(app, config);
}

function configureSwagger(app: INestApplication, env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV === 'production') return;
  const document = buildSwaggerDocument(app);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}

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
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(PinoLogger)));
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  configureSwagger(app, env);

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
    const app = await nestFactory.create(AppModule, { bufferLogs: true });
    app.useLogger(app.get(PinoLogger));
    app.enableShutdownHooks();
    configureHttpApp(app, env);

    const port = Number(env.PORT ?? 3000);
    const host = env.HOST ?? '0.0.0.0';
    await app.listen(port, host);
    Logger.log(`HTTP server listening on http://${host}:${port}`);

    process.on('SIGTERM', () => {
      Logger.log('SIGTERM received, closing app...');
      void app
        .close()
        .then(() => process.exit(0))
        .catch((err) => {
          Logger.error('Error during shutdown', err);
          process.exit(1);
        });
    });
    process.on('SIGINT', () => {
      Logger.log('SIGINT received, closing app...');
      void app
        .close()
        .then(() => process.exit(0))
        .catch((err) => {
          Logger.error('Error during shutdown', err);
          process.exit(1);
        });
    });

    return app;
  }

  const appContext = await nestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  appContext.useLogger(appContext.get(PinoLogger));
  appContext.enableShutdownHooks();
  Logger.log(`Standalone context ready for role: ${role}`);

  process.on('SIGTERM', () => {
    Logger.log('SIGTERM received, closing context...');
    void appContext
      .close()
      .then(() => process.exit(0))
      .catch((err) => {
        Logger.error('Error during shutdown', err);
        process.exit(1);
      });
  });
  process.on('SIGINT', () => {
    Logger.log('SIGINT received, closing context...');
    void appContext
      .close()
      .then(() => process.exit(0))
      .catch((err) => {
        Logger.error('Error during shutdown', err);
        process.exit(1);
      });
  });

  return appContext;
}
