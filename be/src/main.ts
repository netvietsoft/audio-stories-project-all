import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

// Patch BigInt so it can be serialized to JSON natively
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Raw body parser for Stripe webhooks
  app.use('/billing/webhook/stripe', json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  const corsEnv = process.env.CORS || process.env.ALLOWED_CLIENT_URLS || '';
  const allowedOrigins = corsEnv
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS not allowed'));
    },
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
