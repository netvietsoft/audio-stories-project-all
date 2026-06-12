import type { DynamicModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

export type AppRole = 'api' | 'worker' | 'scheduler';

const APP_ROLES = new Set<AppRole>(['api', 'worker', 'scheduler']);

export function getAppRole(value: string | undefined | null): AppRole {
  const normalized = value?.trim();

  if (!normalized) {
    return 'api';
  }

  if (APP_ROLES.has(normalized as AppRole)) {
    return normalized as AppRole;
  }

  throw new Error(
    `Invalid APP_ROLE "${value}". Expected one of: api, worker, scheduler.`,
  );
}

export function shouldStartHttpServer(role: AppRole): boolean {
  return role === 'api';
}

export function shouldEnableScheduler(role: AppRole): boolean {
  return role === 'scheduler';
}

export function buildScheduleImports(env: NodeJS.ProcessEnv = process.env): DynamicModule[] {
  const role = getAppRole(env.APP_ROLE);

  if (!shouldEnableScheduler(role)) {
    return [];
  }

  return [ScheduleModule.forRoot()];
}
