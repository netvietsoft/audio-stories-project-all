/**
 * test-app.factory.ts – Factory tạo NestJS test application.
 *
 * Reuse qua tất cả file test E2E để tránh lặp code boilerplate.
 * Áp dụng đúng cấu hình middleware như main.ts thật.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test trước khi import bất kỳ thứ gì dùng ConfigModule
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

// BigInt serialization patch
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// ─── Shared app instance ─────────────────────────────────────────────────────
let sharedApp: INestApplication | null = null;

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  await app.init();
  return app;
}

/**
 * Lấy shared app instance (tạo mới nếu chưa có).
 * Dùng trong beforeAll() để khởi tạo 1 lần cho cả suite.
 */
export async function getSharedApp(): Promise<INestApplication> {
  if (!sharedApp) {
    sharedApp = await createTestApp();
  }
  return sharedApp;
}

export async function closeSharedApp(): Promise<void> {
  if (sharedApp) {
    await sharedApp.close();
    sharedApp = null;
  }
}

/**
 * Helper lấy PrismaService từ app để thực hiện DB assertion.
 */
export function getPrisma(app: INestApplication): PrismaService {
  return app.get<PrismaService>(PrismaService);
}
