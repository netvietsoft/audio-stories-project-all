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
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  const frontendUrl = process.env.FRONTEND_URL;
  const allowedOrigins = new Set<string>();

  if (frontendUrl) allowedOrigins.add(frontendUrl.trim());

  // Allow localhost/127.0.0.1 during development
  if (process.env.NODE_ENV !== 'production') {
    ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3058', 'http://127.0.0.1:3058'].forEach((u) => allowedOrigins.add(u));
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.size === 0) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      callback(new Error('CORS not allowed'));
    },
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 8035);
  await app.listen(port);
}
bootstrap();
