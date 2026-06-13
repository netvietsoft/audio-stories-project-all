# BE Refactor Phase 0a — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build foundation BE chuẩn production tối thiểu — typed config, structured logging, error envelope, health, OpenAPI, architectural rules, graceful shutdown, Docker, CI — trước khi đụng vào god-services trong Phase 1.

**Architecture:** Tạo mới `src/shared/` chứa cross-cutting concerns (kernel, config, http, logging, health). Giữ nguyên 28 feature modules. Wire-up qua `app.module.ts` và `bootstrap.ts`. Drop legacy ENV aliases vì chưa deploy production.

**Tech Stack:** NestJS 11, Prisma 6, Zod (mới), nestjs-pino + pino (mới), @nestjs/swagger (mới), @nestjs/terminus (mới), dependency-cruiser (mới, dev), Docker, GitHub Actions.

**Scope:** Plan này chỉ cover Phase 0a (~1.5-2 tuần full-time). Phase 0b (Schema split) + Phase 1 (Stories) + Phase 2 + Phase 3 sẽ có plan riêng khi tới gate G0a pass.

**Reference spec:** `docs/superpowers/specs/2026-06-13-be-refactor-design.md`

---

## File Structure

### Files to create

```
be/src/shared/
├── kernel/
│   ├── result.ts                                     # Result<T,E> type
│   ├── domain-error.ts                               # DomainError base class
│   └── __tests__/
│       ├── result.spec.ts
│       └── domain-error.spec.ts
│
├── config/
│   ├── app-config.schema.ts                          # zod schema
│   ├── app-config.service.ts                         # typed accessor
│   ├── app-config.module.ts                          # global Nest module
│   └── __tests__/
│       └── app-config.schema.spec.ts
│
├── logging/
│   ├── logger.module.ts                              # nestjs-pino setup
│   ├── correlation-id.middleware.ts                  # x-request-id binding
│   └── __tests__/
│       └── correlation-id.middleware.spec.ts
│
├── http/
│   ├── api-response.ts                               # envelope types
│   ├── api-response.interceptor.ts                   # wrap success
│   ├── global-exception.filter.ts                    # all errors → envelope
│   └── __tests__/
│       └── global-exception.filter.spec.ts
│
└── health/
    ├── health.controller.ts                          # /healthz + /readyz
    ├── health.module.ts
    └── __tests__/
        └── health.controller.spec.ts

be/scripts/generate-openapi.ts                        # emit openapi.json
be/Dockerfile
be/.dockerignore
be/docker-compose.dev.yml
be/.dependency-cruiser.cjs                            # dep-cruiser config
be/.github/workflows/ci.yml                           # CI minimal
```

### Files to modify

```
be/package.json                                       # add deps + scripts
be/eslint.config.mjs                                  # no-restricted-imports rule
be/src/main.ts                                        # (unchanged but verified)
be/src/bootstrap.ts                                   # integrate config + filter + interceptor + swagger + shutdown
be/src/app.module.ts                                  # AppConfigModule, LoggerModule, HealthModule; remove inline ConfigModule
be/.env.example                                       # drop legacy aliases
be/.env                                               # drop legacy aliases
be/.env.prod                                          # drop legacy aliases
be/src/mail/mail.service.ts                           # remove MAIL_FROM fallback
be/src/billing/services/vietqr.service.ts             # remove VIETQR_ACQ_ID fallback
be/src/upload/audio-upload.service.ts                 # remove R2_SECRET_KEY_ID fallback
be/src/env-example.spec.ts                            # update assertions (drop aliases)
```

### Files to delete

```
be/src/common/env-alias.util.ts                       # no longer needed
be/src/common/env-alias.util.spec.ts                  # ditto
be/src/common/filters/prisma-exception.filter.ts      # superseded by GlobalExceptionFilter
```

---

## Task 1: Bootstrap shared/ + Result<T,E> + DomainError

**Files:**
- Create: `be/src/shared/kernel/result.ts`
- Create: `be/src/shared/kernel/domain-error.ts`
- Create: `be/src/shared/kernel/__tests__/result.spec.ts`
- Create: `be/src/shared/kernel/__tests__/domain-error.spec.ts`

- [ ] **Step 1: Write failing test for Result**

`be/src/shared/kernel/__tests__/result.spec.ts`:

```ts
import { Result } from '../result';

describe('Result', () => {
  describe('Result.ok', () => {
    it('marks isOk true and isErr false', () => {
      const r = Result.ok(42);
      expect(r.isOk).toBe(true);
      expect(r.isErr).toBe(false);
    });

    it('exposes value via unwrap', () => {
      expect(Result.ok('hello').unwrap()).toBe('hello');
    });
  });

  describe('Result.err', () => {
    it('marks isOk false and isErr true', () => {
      const r = Result.err(new Error('boom'));
      expect(r.isOk).toBe(false);
      expect(r.isErr).toBe(true);
    });

    it('throws on unwrap of err', () => {
      const r = Result.err(new Error('boom'));
      expect(() => r.unwrap()).toThrow('boom');
    });

    it('exposes error via unwrapErr', () => {
      const err = new Error('boom');
      expect(Result.err(err).unwrapErr()).toBe(err);
    });
  });

  describe('map / mapErr', () => {
    it('map transforms ok value, leaves err untouched', () => {
      expect(Result.ok(2).map((n) => n * 10).unwrap()).toBe(20);
      const err = new Error('x');
      expect(Result.err<number, Error>(err).map((n) => n * 10).unwrapErr()).toBe(err);
    });

    it('mapErr transforms err, leaves ok untouched', () => {
      expect(Result.err<number, string>('a').mapErr((s) => s + 'b').unwrapErr()).toBe('ab');
      expect(Result.ok<number, string>(2).mapErr((s) => s + 'b').unwrap()).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```
cd be
yarn jest src/shared/kernel/__tests__/result.spec.ts
```
Expected: FAIL (cannot find module `../result`).

- [ ] **Step 3: Implement Result**

`be/src/shared/kernel/result.ts`:

```ts
export class Result<T, E> {
  private constructor(
    private readonly _value: T | undefined,
    private readonly _error: E | undefined,
    public readonly isOk: boolean,
  ) {}

  static ok<T, E = never>(value: T): Result<T, E> {
    return new Result<T, E>(value, undefined, true);
  }

  static err<T = never, E = unknown>(error: E): Result<T, E> {
    return new Result<T, E>(undefined, error, false);
  }

  get isErr(): boolean {
    return !this.isOk;
  }

  unwrap(): T {
    if (!this.isOk) {
      const err = this._error;
      if (err instanceof Error) throw err;
      throw new Error(`Result.unwrap on err: ${String(err)}`);
    }
    return this._value as T;
  }

  unwrapErr(): E {
    if (this.isOk) {
      throw new Error('Result.unwrapErr on ok');
    }
    return this._error as E;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return this.isOk ? Result.ok<U, E>(fn(this._value as T)) : Result.err<U, E>(this._error as E);
  }

  mapErr<F>(fn: (err: E) => F): Result<T, F> {
    return this.isOk ? Result.ok<T, F>(this._value as T) : Result.err<T, F>(fn(this._error as E));
  }
}
```

- [ ] **Step 4: Run test, expect PASS**

```
yarn jest src/shared/kernel/__tests__/result.spec.ts
```
Expected: PASS, 6 tests.

- [ ] **Step 5: Write failing test for DomainError**

`be/src/shared/kernel/__tests__/domain-error.spec.ts`:

```ts
import { DomainError } from '../domain-error';

class StoryNotFound extends DomainError {
  readonly code = 'STORY_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(public readonly storyId: string) {
    super(`Story ${storyId} not found`);
  }
}

describe('DomainError', () => {
  it('is an Error instance', () => {
    const err = new StoryNotFound('abc');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
  });

  it('exposes code and httpStatus', () => {
    const err = new StoryNotFound('abc');
    expect(err.code).toBe('STORY_NOT_FOUND');
    expect(err.httpStatus).toBe(404);
  });

  it('carries the message', () => {
    expect(new StoryNotFound('abc').message).toBe('Story abc not found');
  });

  it('carries the stack', () => {
    expect(new StoryNotFound('abc').stack).toBeDefined();
  });
});
```

- [ ] **Step 6: Run test, expect FAIL**

```
yarn jest src/shared/kernel/__tests__/domain-error.spec.ts
```
Expected: FAIL (cannot find module `../domain-error`).

- [ ] **Step 7: Implement DomainError**

`be/src/shared/kernel/domain-error.ts`:

```ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }

  toJSON(): { code: string; message: string } {
    return { code: this.code, message: this.message };
  }
}
```

- [ ] **Step 8: Run all kernel tests, expect PASS**

```
yarn jest src/shared/kernel
```
Expected: PASS, all tests.

- [ ] **Step 9: Run full test suite to confirm no regression**

```
yarn jest
```
Expected: PASS (all previously-passing tests still pass).

- [ ] **Step 10: Commit**

```bash
git add be/src/shared/kernel
git commit -m "feat(be): add Result<T,E> and DomainError shared kernel types"
```

---

## Task 2: Typed config with Zod

**Files:**
- Modify: `be/package.json` (add `zod`)
- Create: `be/src/shared/config/app-config.schema.ts`
- Create: `be/src/shared/config/app-config.service.ts`
- Create: `be/src/shared/config/app-config.module.ts`
- Create: `be/src/shared/config/__tests__/app-config.schema.spec.ts`

- [ ] **Step 1: Install Zod**

```
cd be
yarn add zod
```
Expected: package.json shows `"zod": "^3.x"`.

- [ ] **Step 2: Write failing test for env schema**

`be/src/shared/config/__tests__/app-config.schema.spec.ts`:

```ts
import { parseAppConfig } from '../app-config.schema';

const validEnv = (overrides: Record<string, string | undefined> = {}) => ({
  APP_ROLE: 'api',
  NODE_ENV: 'development',
  HOST: '0.0.0.0',
  PORT: '3000',
  DATABASE_URL: 'mysql://user:pass@host:3306/db',
  REDIS_URL: 'redis://localhost:6379/0',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_TTL: '7d',
  JWT_REFRESH_TTL: '30d',
  WEB_ORIGIN: 'http://localhost:3001',
  ADMIN_ORIGIN: 'http://localhost:3002',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_FROM: 'no-reply@example.com',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'admin123',
  INTERNAL_API_KEY: 'k'.repeat(16),
  ...overrides,
});

describe('parseAppConfig', () => {
  it('parses a valid env', () => {
    const cfg = parseAppConfig(validEnv());
    expect(cfg.runtime.appRole).toBe('api');
    expect(cfg.runtime.port).toBe(3000);
    expect(cfg.database.url).toBe('mysql://user:pass@host:3306/db');
    expect(cfg.auth.jwtAccessSecret).toBe('a'.repeat(32));
  });

  it('coerces PORT to number', () => {
    const cfg = parseAppConfig(validEnv({ PORT: '4000' }));
    expect(typeof cfg.runtime.port).toBe('number');
    expect(cfg.runtime.port).toBe(4000);
  });

  it('throws when required env missing', () => {
    expect(() => parseAppConfig(validEnv({ DATABASE_URL: undefined }))).toThrow(/DATABASE_URL/);
  });

  it('throws when APP_ROLE is invalid', () => {
    expect(() => parseAppConfig(validEnv({ APP_ROLE: 'bogus' }))).toThrow(/APP_ROLE/);
  });

  it('throws when JWT secret too short', () => {
    expect(() => parseAppConfig(validEnv({ JWT_ACCESS_SECRET: 'short' }))).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects legacy MAIL_FROM alias', () => {
    expect(() => parseAppConfig({ ...validEnv(), MAIL_FROM: 'legacy@example.com' })).toThrow(
      /MAIL_FROM.*deprecated|removed/i,
    );
  });
});
```

- [ ] **Step 3: Run test, expect FAIL**

```
yarn jest src/shared/config/__tests__/app-config.schema.spec.ts
```
Expected: FAIL (cannot find module).

- [ ] **Step 4: Implement app-config.schema.ts**

`be/src/shared/config/app-config.schema.ts`:

```ts
import { z } from 'zod';

const stringNonEmpty = z.string().trim().min(1);

const LEGACY_ALIASES = ['MAIL_FROM', 'VIETQR_DEFAULT_TEMPLATE', 'VIETQR_ACQ_ID', 'R2_SECRET_KEY_ID'] as const;

const RawEnvSchema = z
  .object({
    APP_ROLE: z.enum(['api', 'worker', 'scheduler']),
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
    HOST: stringNonEmpty.default('0.0.0.0'),
    PORT: z.coerce.number().int().positive().default(3000),

    DATABASE_URL: stringNonEmpty,
    REDIS_URL: stringNonEmpty,
    REDIS_HOST: stringNonEmpty.optional(),
    REDIS_PORT: z.coerce.number().int().positive().optional(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().int().nonnegative().optional(),

    JWT_ACCESS_SECRET: stringNonEmpty.min(32, 'JWT_ACCESS_SECRET must be ≥ 32 chars'),
    JWT_REFRESH_SECRET: stringNonEmpty.min(32, 'JWT_REFRESH_SECRET must be ≥ 32 chars'),
    JWT_ACCESS_TTL: stringNonEmpty.default('7d'),
    JWT_REFRESH_TTL: stringNonEmpty.default('30d'),
    INTERNAL_API_KEY: stringNonEmpty.min(16, 'INTERNAL_API_KEY must be ≥ 16 chars'),

    WEB_ORIGIN: stringNonEmpty,
    ADMIN_ORIGIN: stringNonEmpty,
    FRONTEND_URL: z.string().optional(),
    CLIENT_URL: z.string().optional(),
    ALLOWED_CLIENT_URLS: z.string().optional(),
    CORS: z.string().optional(),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_SECURE: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .default('false')
      .transform((v) => v === true || v === 'true'),

    SMTP_HOST: stringNonEmpty,
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_SECURE: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .default('false')
      .transform((v) => v === true || v === 'true'),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: stringNonEmpty,

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().optional(),

    STORAGE_PROVIDER: z.enum(['r2', 's3', 'uploadthing']).default('r2'),
    UPLOADTHING_TOKEN: z.string().optional(),
    R2_TOKEN: z.string().optional(),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NAME: z.string().optional(),
    R2_URL: z.string().optional(),
    R2_ENDPOINT: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),
    AWS_BUCKET_NAME: z.string().optional(),

    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    USD_TO_VND_RATE: z.coerce.number().positive().optional(),

    VIETQR_API_URL: z.string().optional(),
    VIETQR_CLIENT_ID: z.string().optional(),
    VIETQR_API_KEY: z.string().optional(),
    VIETQR_ACCOUNT_NO: z.string().optional(),
    VIETQR_ACCOUNT_NAME: z.string().optional(),
    VIETQR_BANK_ID: z.string().optional(),
    VIETQR_TEMPLATE: z.string().default('compact2'),
    VIETQR_QR_FORMAT: z.string().optional(),
    VIETQR_EXCHANGE_RATE: z.coerce.number().positive().optional(),
    VIETQR_ORDER_EXPIRY_MINUTES: z.coerce.number().int().positive().optional(),

    CASSO_API_URL: z.string().optional(),
    CASSO_API_KEY: z.string().optional(),
    CASSO_SECURE_TOKEN: z.string().optional(),
    CASSO_WEBHOOK_URL: z.string().optional(),

    ADMIN_EMAIL: stringNonEmpty,
    ADMIN_PASSWORD: stringNonEmpty,

    THROTTLE_DISABLED: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .default('false')
      .transform((v) => v === true || v === 'true'),

    E2E_CLEANUP: z.string().optional(),
    TEST_STORY_SLUG: z.string().optional(),
    TEST_USER_TOKEN: z.string().optional(),
    TEST_ADMIN_TOKEN: z.string().optional(),
  })
  .superRefine((raw, ctx) => {
    for (const alias of LEGACY_ALIASES) {
      if ((raw as Record<string, unknown>)[alias] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [alias],
          message: `${alias} is deprecated and was removed. Use the canonical name instead.`,
        });
      }
    }
  });

export type RawEnv = z.infer<typeof RawEnvSchema>;

export interface AppConfig {
  runtime: { appRole: 'api' | 'worker' | 'scheduler'; nodeEnv: 'development' | 'test' | 'staging' | 'production'; host: string; port: number };
  database: { url: string };
  redis: { url: string; host?: string; port?: number; password?: string; db?: number };
  auth: { jwtAccessSecret: string; jwtRefreshSecret: string; jwtAccessTtl: string; jwtRefreshTtl: string; internalApiKey: string };
  cors: { webOrigin: string; adminOrigin: string; frontendUrl?: string; clientUrl?: string; allowedClientUrls?: string; raw?: string; cookieDomain?: string; cookieSameSite: 'lax' | 'strict' | 'none'; cookieSecure: boolean };
  mail: { host: string; port: number; secure: boolean; user?: string; pass?: string; from: string };
  oauth: { googleClientId?: string; googleClientSecret?: string; googleCallbackUrl?: string };
  storage: { provider: 'r2' | 's3' | 'uploadthing'; uploadthingToken?: string; r2: { token?: string; accountId?: string; accessKeyId?: string; secretAccessKey?: string; bucketName?: string; url?: string; endpoint?: string }; aws: { accessKeyId?: string; secretAccessKey?: string; region?: string; bucketName?: string } };
  payment: { stripeSecretKey?: string; stripeWebhookSecret?: string; usdToVndRate?: number; vietqr: { apiUrl?: string; clientId?: string; apiKey?: string; accountNo?: string; accountName?: string; bankId?: string; template: string; qrFormat?: string; exchangeRate?: number; orderExpiryMinutes?: number }; casso: { apiUrl?: string; apiKey?: string; secureToken?: string; webhookUrl?: string } };
  admin: { email: string; password: string };
  rateLimit: { disabled: boolean };
  testing: { e2eCleanup?: string; testStorySlug?: string; testUserToken?: string; testAdminToken?: string };
}

export function parseAppConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): AppConfig {
  const raw = RawEnvSchema.parse(env);
  return {
    runtime: { appRole: raw.APP_ROLE, nodeEnv: raw.NODE_ENV, host: raw.HOST, port: raw.PORT },
    database: { url: raw.DATABASE_URL },
    redis: { url: raw.REDIS_URL, host: raw.REDIS_HOST, port: raw.REDIS_PORT, password: raw.REDIS_PASSWORD, db: raw.REDIS_DB },
    auth: {
      jwtAccessSecret: raw.JWT_ACCESS_SECRET,
      jwtRefreshSecret: raw.JWT_REFRESH_SECRET,
      jwtAccessTtl: raw.JWT_ACCESS_TTL,
      jwtRefreshTtl: raw.JWT_REFRESH_TTL,
      internalApiKey: raw.INTERNAL_API_KEY,
    },
    cors: {
      webOrigin: raw.WEB_ORIGIN,
      adminOrigin: raw.ADMIN_ORIGIN,
      frontendUrl: raw.FRONTEND_URL,
      clientUrl: raw.CLIENT_URL,
      allowedClientUrls: raw.ALLOWED_CLIENT_URLS,
      raw: raw.CORS,
      cookieDomain: raw.COOKIE_DOMAIN,
      cookieSameSite: raw.COOKIE_SAME_SITE,
      cookieSecure: raw.COOKIE_SECURE,
    },
    mail: {
      host: raw.SMTP_HOST,
      port: raw.SMTP_PORT,
      secure: raw.SMTP_SECURE,
      user: raw.SMTP_USER,
      pass: raw.SMTP_PASS,
      from: raw.SMTP_FROM,
    },
    oauth: {
      googleClientId: raw.GOOGLE_CLIENT_ID,
      googleClientSecret: raw.GOOGLE_CLIENT_SECRET,
      googleCallbackUrl: raw.GOOGLE_CALLBACK_URL,
    },
    storage: {
      provider: raw.STORAGE_PROVIDER,
      uploadthingToken: raw.UPLOADTHING_TOKEN,
      r2: {
        token: raw.R2_TOKEN,
        accountId: raw.R2_ACCOUNT_ID,
        accessKeyId: raw.R2_ACCESS_KEY_ID,
        secretAccessKey: raw.R2_SECRET_ACCESS_KEY,
        bucketName: raw.R2_BUCKET_NAME,
        url: raw.R2_URL,
        endpoint: raw.R2_ENDPOINT,
      },
      aws: {
        accessKeyId: raw.AWS_ACCESS_KEY_ID,
        secretAccessKey: raw.AWS_SECRET_ACCESS_KEY,
        region: raw.AWS_REGION,
        bucketName: raw.AWS_BUCKET_NAME,
      },
    },
    payment: {
      stripeSecretKey: raw.STRIPE_SECRET_KEY,
      stripeWebhookSecret: raw.STRIPE_WEBHOOK_SECRET,
      usdToVndRate: raw.USD_TO_VND_RATE,
      vietqr: {
        apiUrl: raw.VIETQR_API_URL,
        clientId: raw.VIETQR_CLIENT_ID,
        apiKey: raw.VIETQR_API_KEY,
        accountNo: raw.VIETQR_ACCOUNT_NO,
        accountName: raw.VIETQR_ACCOUNT_NAME,
        bankId: raw.VIETQR_BANK_ID,
        template: raw.VIETQR_TEMPLATE,
        qrFormat: raw.VIETQR_QR_FORMAT,
        exchangeRate: raw.VIETQR_EXCHANGE_RATE,
        orderExpiryMinutes: raw.VIETQR_ORDER_EXPIRY_MINUTES,
      },
      casso: {
        apiUrl: raw.CASSO_API_URL,
        apiKey: raw.CASSO_API_KEY,
        secureToken: raw.CASSO_SECURE_TOKEN,
        webhookUrl: raw.CASSO_WEBHOOK_URL,
      },
    },
    admin: { email: raw.ADMIN_EMAIL, password: raw.ADMIN_PASSWORD },
    rateLimit: { disabled: raw.THROTTLE_DISABLED },
    testing: {
      e2eCleanup: raw.E2E_CLEANUP,
      testStorySlug: raw.TEST_STORY_SLUG,
      testUserToken: raw.TEST_USER_TOKEN,
      testAdminToken: raw.TEST_ADMIN_TOKEN,
    },
  };
}
```

- [ ] **Step 5: Run schema test, expect PASS**

```
yarn jest src/shared/config/__tests__/app-config.schema.spec.ts
```
Expected: PASS, 6 tests.

- [ ] **Step 6: Implement AppConfigService and AppConfigModule**

`be/src/shared/config/app-config.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AppConfig } from './app-config.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly cfg: AppConfig) {}

  get runtime() { return this.cfg.runtime; }
  get database() { return this.cfg.database; }
  get redis() { return this.cfg.redis; }
  get auth() { return this.cfg.auth; }
  get cors() { return this.cfg.cors; }
  get mail() { return this.cfg.mail; }
  get oauth() { return this.cfg.oauth; }
  get storage() { return this.cfg.storage; }
  get payment() { return this.cfg.payment; }
  get admin() { return this.cfg.admin; }
  get rateLimit() { return this.cfg.rateLimit; }
  get testing() { return this.cfg.testing; }
}
```

`be/src/shared/config/app-config.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { parseAppConfig } from './app-config.schema';
import { AppConfigService } from './app-config.service';

const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env';
loadDotenv({ path: resolve(process.cwd(), envFile) });

const config = parseAppConfig(process.env);

@Global()
@Module({
  providers: [
    {
      provide: AppConfigService,
      useValue: new AppConfigService(config),
    },
  ],
  exports: [AppConfigService],
})
export class AppConfigModule {}
```

> Note: `dotenv` is already an indirect dependency via `dotenv-cli`. If TS complains it's not declared, add `yarn add dotenv` first.

- [ ] **Step 7: Wire AppConfigModule into app.module.ts**

`be/src/app.module.ts` — replace the existing `ConfigModule.forRoot(...)` block at lines 40-43 with:

```ts
import { AppConfigModule } from './shared/config/app-config.module';

// ... in imports array, replace ConfigModule.forRoot({...}) with:
AppConfigModule,
```

Also remove the now-unused `ConfigModule, ConfigService` imports if no other code in `app.module.ts` references them. Keep `ConfigService` import only if `CacheModule.registerAsync` still uses it; otherwise rewrite that block:

```ts
import { AppConfigService } from './shared/config/app-config.service';

CacheModule.registerAsync({
  isGlobal: true,
  inject: [AppConfigService],
  useFactory: async (cfg: AppConfigService) => {
    const redisUrl = cfg.redis.url;
    return {
      store: await redisStore({ url: redisUrl }),
      ttl: 300,
    };
  },
}),
```

- [ ] **Step 8: Boot smoke test — app starts with valid env**

```
yarn build
yarn start:prod
```
(Make sure `.env` has valid values per `.env.example`.)
Expected: Nest boots without throwing. Logs show "HTTP server listening on http://0.0.0.0:3000".
Kill with Ctrl+C.

- [ ] **Step 9: Boot fail test — app refuses to start with missing JWT_ACCESS_SECRET**

```
env JWT_ACCESS_SECRET="" yarn start:prod
```
Expected: Process exits non-zero. Stderr shows zod validation error mentioning `JWT_ACCESS_SECRET`.

- [ ] **Step 10: Run all tests to confirm no regression**

```
yarn jest
```
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add be/package.json be/yarn.lock be/src/shared/config be/src/app.module.ts
git commit -m "feat(be): introduce zod-validated AppConfig, replace ConfigModule"
```

---

## Task 3: Drop legacy ENV aliases

**Files:**
- Delete: `be/src/common/env-alias.util.ts`
- Delete: `be/src/common/env-alias.util.spec.ts`
- Modify: `be/src/mail/mail.service.ts`
- Modify: `be/src/billing/services/vietqr.service.ts`
- Modify: `be/src/upload/audio-upload.service.ts`
- Modify: `be/src/env-example.spec.ts`
- Modify: `be/.env.example`
- Modify: `be/.env`
- Modify: `be/.env.prod`

- [ ] **Step 1: Read mail.service.ts to find MAIL_FROM usage**

```
yarn grep -rn "MAIL_FROM\|resolveMailFromAddress" be/src/mail/
```
Expected: identify the lines that read MAIL_FROM or use `resolveMailFromAddress`. The current code in `mail.service.ts:17` reads `MAIL_FROM` directly.

- [ ] **Step 2: Update mail.service.ts to read from AppConfigService**

In `be/src/mail/mail.service.ts`, replace ConfigService usage with AppConfigService:

```ts
import { AppConfigService } from '../shared/config/app-config.service';

@Injectable()
export class MailService {
  constructor(private readonly cfg: AppConfigService) {}

  // Wherever previously: this.cfg.get<string>('MAIL_FROM') or resolveMailFromAddress(...)
  // Replace with:
  private get fromAddress(): string {
    return this.cfg.mail.from;
  }

  // ... rest of methods use this.cfg.mail.host, this.cfg.mail.port, etc.
}
```

> Specific lines/methods depend on current implementation — preserve all existing behaviors, only swap config source.

- [ ] **Step 3: Update vietqr.service.ts to drop VIETQR_ACQ_ID fallback**

In `be/src/billing/services/vietqr.service.ts:22-29`, replace:

```ts
// OLD:
(process.env.VIETQR_BANK_ID || process.env.VIETQR_ACQ_ID) && ...
return process.env.VIETQR_BANK_ID || process.env.VIETQR_ACQ_ID || '';
```

with reads from `AppConfigService.payment.vietqr.bankId`:

```ts
constructor(private readonly cfg: AppConfigService) {}

private get bankId(): string {
  return this.cfg.payment.vietqr.bankId ?? '';
}
```

Replace all `process.env.VIETQR_*` reads in this file with `this.cfg.payment.vietqr.*`.

- [ ] **Step 4: Update audio-upload.service.ts to drop R2_SECRET_KEY_ID fallback**

In `be/src/upload/audio-upload.service.ts:37`, replace:

```ts
// OLD:
this.configService.get<string>('R2_SECRET_ACCESS_KEY') || this.configService.get<string>('R2_SECRET_KEY_ID');
```

with:

```ts
this.cfg.storage.r2.secretAccessKey;
```

(Update constructor to inject `AppConfigService` instead of `ConfigService` if not already done.)

- [ ] **Step 5: Update env-example.spec.ts to drop alias assertions**

In `be/src/env-example.spec.ts`, remove these lines from the asserted env key list:
- `'MAIL_FROM'` (line ~55)
- `'R2_SECRET_KEY_ID'` (line ~65)
- `'VIETQR_ACQ_ID'` (line ~82)
- `'VIETQR_DEFAULT_TEMPLATE'` (line ~84)

Also add **negative** assertions:

```ts
it('does not document legacy aliases', () => {
  const envExample = readFileSync(envExamplePath, 'utf-8');
  expect(envExample).not.toContain('MAIL_FROM=');
  expect(envExample).not.toContain('R2_SECRET_KEY_ID=');
  expect(envExample).not.toContain('VIETQR_ACQ_ID=');
  expect(envExample).not.toContain('VIETQR_DEFAULT_TEMPLATE=');
});
```

- [ ] **Step 6: Delete env-alias.util.ts and its spec**

```
rm be/src/common/env-alias.util.ts
rm be/src/common/env-alias.util.spec.ts
```

- [ ] **Step 7: Update .env.example, .env, .env.prod**

Remove these lines (and their preceding `# Legacy alias still accepted by code` comments) from all three files:
```
MAIL_FROM=...
R2_SECRET_KEY_ID=...
VIETQR_ACQ_ID=...
VIETQR_DEFAULT_TEMPLATE=...
```

- [ ] **Step 8: Run env-example test, expect PASS**

```
yarn jest src/env-example.spec.ts
```
Expected: PASS — including new negative assertion.

- [ ] **Step 9: Boot smoke test**

```
yarn build && yarn start:prod
```
Expected: Boot success. No reference errors. Mail/VietQR/R2 read from new config.
Then test: set `MAIL_FROM=test@example.com` in `.env`, run again.
Expected: FAIL boot with "MAIL_FROM is deprecated".

- [ ] **Step 10: Run full test suite**

```
yarn jest
```
Expected: PASS. No reference to `env-alias.util` remains.

```
yarn lint
```
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add be/src/mail/mail.service.ts be/src/billing/services/vietqr.service.ts be/src/upload/audio-upload.service.ts be/src/env-example.spec.ts be/.env.example be/.env be/.env.prod
git rm be/src/common/env-alias.util.ts be/src/common/env-alias.util.spec.ts
git commit -m "refactor(be): drop legacy ENV aliases (MAIL_FROM, VIETQR_*, R2_SECRET_KEY_ID)"
```

---

## Task 4: Pino structured logging + correlation-id middleware

**Files:**
- Modify: `be/package.json` (add `nestjs-pino`, `pino`, `pino-pretty`, `pino-http`)
- Create: `be/src/shared/logging/logger.module.ts`
- Create: `be/src/shared/logging/correlation-id.middleware.ts`
- Create: `be/src/shared/logging/__tests__/correlation-id.middleware.spec.ts`
- Modify: `be/src/app.module.ts`
- Modify: `be/src/bootstrap.ts`

- [ ] **Step 1: Install Pino**

```
cd be
yarn add nestjs-pino pino pino-http
yarn add -D pino-pretty
```

- [ ] **Step 2: Write failing test for correlation-id middleware**

`be/src/shared/logging/__tests__/correlation-id.middleware.spec.ts`:

```ts
import { CorrelationIdMiddleware, CORRELATION_ID_HEADER } from '../correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
    req = { headers: {} };
    res = { setHeader: jest.fn() };
    next = jest.fn();
  });

  it('generates a new id when header missing', () => {
    middleware.use(req, res, next);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, req.id);
    expect(next).toHaveBeenCalled();
  });

  it('reuses incoming header when valid uuid', () => {
    const incoming = '11111111-2222-3333-4444-555555555555';
    req.headers[CORRELATION_ID_HEADER.toLowerCase()] = incoming;
    middleware.use(req, res, next);
    expect(req.id).toBe(incoming);
    expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, incoming);
  });

  it('rejects malformed header and regenerates', () => {
    req.headers[CORRELATION_ID_HEADER.toLowerCase()] = 'not-a-uuid';
    middleware.use(req, res, next);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.id).not.toBe('not-a-uuid');
  });
});
```

- [ ] **Step 3: Run test, expect FAIL**

```
yarn jest src/shared/logging
```
Expected: FAIL (module not found).

- [ ] **Step 4: Implement CorrelationIdMiddleware**

`be/src/shared/logging/correlation-id.middleware.ts`:

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export const CORRELATION_ID_HEADER = 'x-request-id';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

declare module 'http' {
  interface IncomingMessage {
    id?: string;
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void): void {
    const incoming = req.headers?.[CORRELATION_ID_HEADER.toLowerCase()] as string | undefined;
    const id = incoming && UUID_REGEX.test(incoming) ? incoming : randomUUID();
    req.id = id;
    res.setHeader(CORRELATION_ID_HEADER, id);
    next();
  }
}
```

- [ ] **Step 5: Run test, expect PASS**

```
yarn jest src/shared/logging
```
Expected: PASS, 3 tests.

- [ ] **Step 6: Implement LoggerModule with Pino**

`be/src/shared/logging/logger.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { AppConfigService } from '../config/app-config.service';
import { CORRELATION_ID_HEADER } from './correlation-id.middleware';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        pinoHttp: {
          level: cfg.runtime.nodeEnv === 'production' ? 'info' : 'debug',
          customProps: (req: any) => ({ correlationId: req.id }),
          genReqId: (req: any) => req.id,
          autoLogging: { ignore: (req: any) => req.url === '/healthz' || req.url === '/readyz' },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.refreshToken',
              'req.body.accessToken',
              'res.headers["set-cookie"]',
            ],
            censor: '[REDACTED]',
          },
          transport:
            cfg.runtime.nodeEnv === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: false, colorize: true } },
        },
      }),
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}

export { CORRELATION_ID_HEADER };
```

- [ ] **Step 7: Wire LoggerModule + CorrelationIdMiddleware into app.module.ts**

`be/src/app.module.ts` — in imports add `LoggerModule`. Configure middleware:

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerModule } from './shared/logging/logger.module';
import { CorrelationIdMiddleware } from './shared/logging/correlation-id.middleware';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    // ... rest
  ],
  // ...
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

- [ ] **Step 8: Configure Nest to use Pino logger in bootstrap.ts**

In `be/src/bootstrap.ts`, after creating the app:

```ts
import { Logger as PinoLogger } from 'nestjs-pino';

const app = await nestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(PinoLogger));
```

Also update the standalone-context branch:

```ts
const appContext = await nestFactory.createApplicationContext(AppModule, { bufferLogs: true });
appContext.useLogger(appContext.get(PinoLogger));
```

- [ ] **Step 9: Boot smoke test — verify JSON logs in production mode**

```
NODE_ENV=production yarn build && NODE_ENV=production yarn start:prod
```
Expected: log lines are JSON. Each line has `correlationId` field after first request hits the server.

Test with:
```
curl -i http://localhost:3000/  # any route
```
Expected: response has `x-request-id` header. Server log line for that request has same UUID under `correlationId` / `req.id`.

Kill with Ctrl+C.

- [ ] **Step 10: Boot in dev mode and verify pretty output + redact**

```
yarn start:dev
```
Send a request with sensitive headers:
```
curl -H "Authorization: Bearer secret123" -H "Cookie: session=secret456" http://localhost:3000/
```
Expected: log shows `authorization: "[REDACTED]"`, `cookie: "[REDACTED]"`.

- [ ] **Step 11: Run full test suite**

```
yarn jest
```
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add be/package.json be/yarn.lock be/src/shared/logging be/src/app.module.ts be/src/bootstrap.ts
git commit -m "feat(be): add Pino structured logging with correlation-id middleware"
```

---

## Task 5: API response envelope + global exception filter

**Files:**
- Create: `be/src/shared/http/api-response.ts`
- Create: `be/src/shared/http/api-response.interceptor.ts`
- Create: `be/src/shared/http/global-exception.filter.ts`
- Create: `be/src/shared/http/__tests__/global-exception.filter.spec.ts`
- Modify: `be/src/bootstrap.ts`
- Delete: `be/src/common/filters/prisma-exception.filter.ts`

- [ ] **Step 1: Define envelope types**

`be/src/shared/http/api-response.ts`:

```ts
export interface ApiSuccess<T> {
  data: T;
  meta: { requestId?: string; pagination?: { cursor?: string; nextCursor?: string; limit?: number; total?: number } };
}

export interface ApiError {
  error: { code: string; message: string; details?: Record<string, unknown> };
  meta: { requestId?: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function isApiError(r: ApiResponse<unknown>): r is ApiError {
  return (r as ApiError).error !== undefined;
}
```

- [ ] **Step 2: Implement ApiResponseInterceptor**

`be/src/shared/http/api-response.interceptor.ts`:

```ts
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
```

- [ ] **Step 3: Write failing test for GlobalExceptionFilter**

`be/src/shared/http/__tests__/global-exception.filter.spec.ts`:

```ts
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from '../global-exception.filter';
import { DomainError } from '../../kernel/domain-error';

class StoryNotFound extends DomainError {
  readonly code = 'STORY_NOT_FOUND';
  readonly httpStatus = 404;
}

function buildHost(req: any) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const ctx = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;
  return { host: ctx, status, json };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let logger: jest.Mocked<Logger>;

  beforeEach(() => {
    logger = { error: jest.fn(), warn: jest.fn() } as unknown as jest.Mocked<Logger>;
    filter = new GlobalExceptionFilter(logger);
  });

  it('maps DomainError to its httpStatus with code', () => {
    const { host, status, json } = buildHost({ id: 'req-1', method: 'GET', url: '/x' });
    filter.catch(new StoryNotFound('not found'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'STORY_NOT_FOUND', message: 'not found' },
      meta: { requestId: 'req-1' },
    });
  });

  it('maps HttpException to its status', () => {
    const { host, status, json } = buildHost({ id: 'req-2', method: 'POST', url: '/y' });
    filter.catch(new HttpException('bad', HttpStatus.BAD_REQUEST), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'bad' }),
      }),
    );
  });

  it('maps Prisma P2002 to 409 conflict', () => {
    const { host, status, json } = buildHost({ id: 'req-3', method: 'POST', url: '/z' });
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6' } as any);
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'UNIQUE_CONSTRAINT_VIOLATION' }) }),
    );
  });

  it('maps unknown error to 500 INTERNAL', () => {
    const { host, status, json } = buildHost({ id: 'req-4', method: 'GET', url: '/q' });
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INTERNAL_ERROR' }) }),
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test, expect FAIL**

```
yarn jest src/shared/http
```
Expected: FAIL.

- [ ] **Step 5: Implement GlobalExceptionFilter**

`be/src/shared/http/global-exception.filter.ts`:

```ts
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
```

- [ ] **Step 6: Run test, expect PASS**

```
yarn jest src/shared/http
```
Expected: PASS, 4 tests.

- [ ] **Step 7: Wire filter and interceptor into bootstrap.ts**

In `be/src/bootstrap.ts`, inside `configureHttpApp`:

```ts
import { GlobalExceptionFilter } from './shared/http/global-exception.filter';
import { ApiResponseInterceptor } from './shared/http/api-response.interceptor';
import { Logger as PinoLogger } from 'nestjs-pino';

// REMOVE:
// import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
// app.useGlobalFilters(new PrismaExceptionFilter());

// REPLACE WITH:
app.useGlobalFilters(new GlobalExceptionFilter(app.get(PinoLogger)));
app.useGlobalInterceptors(new ApiResponseInterceptor());
```

- [ ] **Step 8: Delete prisma-exception.filter.ts**

```
rm be/src/common/filters/prisma-exception.filter.ts
```

Check no other code imports it:
```
grep -rn "prisma-exception.filter" be/src
```
Expected: no matches.

- [ ] **Step 9: Boot smoke test — verify envelope on success**

```
yarn start:dev
curl http://localhost:3000/  # AppController index route returns a string
```
Expected: response body is `{ "data": "<original string>", "meta": { "requestId": "<uuid>" } }`.

- [ ] **Step 10: Boot smoke test — verify envelope on error**

```
curl http://localhost:3000/non-existent-route
```
Expected: response body is `{ "error": { "code": "NOT_FOUND", "message": "...", ... }, "meta": { "requestId": "<uuid>" } }`.

- [ ] **Step 11: Run full test suite + e2e**

```
yarn jest
yarn test:e2e:auth
```
Expected: e2e tests may need adjustment for new response shape. Investigate failures: if e2e tests assert against `response.body.access_token`, they'll need to read from `response.body.data.access_token`. Update e2e tests minimally to consume the envelope.

- [ ] **Step 12: Commit**

```bash
git add be/src/shared/http be/src/bootstrap.ts be/test/
git rm be/src/common/filters/prisma-exception.filter.ts
git commit -m "feat(be): add API response envelope + global exception filter, drop PrismaExceptionFilter"
```

---

## Task 6: Health & readiness endpoints

**Files:**
- Modify: `be/package.json` (add `@nestjs/terminus`)
- Create: `be/src/shared/health/health.controller.ts`
- Create: `be/src/shared/health/health.module.ts`
- Create: `be/src/shared/health/__tests__/health.controller.spec.ts`
- Modify: `be/src/app.module.ts`

- [ ] **Step 1: Install @nestjs/terminus**

```
cd be
yarn add @nestjs/terminus
```

- [ ] **Step 2: Implement HealthController + HealthModule**

`be/src/shared/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HttpHealthIndicator, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get('healthz')
  liveness() {
    return { status: 'ok' };
  }

  @Get('readyz')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma),
    ]);
  }
}
```

`be/src/shared/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [TerminusModule, HttpModule, PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

If `@nestjs/axios` is not installed, install with `yarn add @nestjs/axios @nestjs/common`. The Prisma indicator works without HttpModule, but Terminus may peer-require it; remove `HttpModule` import if Terminus doesn't complain.

- [ ] **Step 3: Write failing test for liveness**

`be/src/shared/health/__tests__/health.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { HealthController } from '../health.controller';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../../../prisma/prisma.service';

describe('HealthController', () => {
  let ctrl: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: { check: jest.fn() } },
        { provide: PrismaHealthIndicator, useValue: { pingCheck: jest.fn() } },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    ctrl = moduleRef.get(HealthController);
  });

  it('liveness returns { status: ok }', () => {
    expect(ctrl.liveness()).toEqual({ status: 'ok' });
  });

  it('readiness delegates to terminus', async () => {
    const checkResult = { status: 'ok' as const, info: {}, error: {}, details: {} };
    const healthSvc = ctrl['health'] as any;
    healthSvc.check.mockResolvedValue(checkResult);
    const result = await ctrl.readiness();
    expect(result).toBe(checkResult);
    expect(healthSvc.check).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test, expect PASS** (we have all files in place now)

```
yarn jest src/shared/health
```
Expected: PASS, 2 tests.

- [ ] **Step 5: Wire HealthModule into app.module.ts**

In `be/src/app.module.ts`, add to imports:

```ts
import { HealthModule } from './shared/health/health.module';

// imports: [..., HealthModule, ...]
```

- [ ] **Step 6: Boot smoke test**

```
yarn start:dev
curl -i http://localhost:3000/healthz
```
Expected: 200 with body `{ "data": { "status": "ok" }, "meta": { "requestId": "..." } }`.

```
curl -i http://localhost:3000/readyz
```
Expected: 200 with terminus payload wrapped in envelope. Verify DB ping.

- [ ] **Step 7: Run full test suite**

```
yarn jest
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add be/package.json be/yarn.lock be/src/shared/health be/src/app.module.ts
git commit -m "feat(be): add /healthz liveness and /readyz readiness endpoints"
```

---

## Task 7: OpenAPI/Swagger + generate-openapi.ts script

**Files:**
- Modify: `be/package.json` (add `@nestjs/swagger`, add `openapi` script)
- Create: `be/scripts/generate-openapi.ts`
- Modify: `be/src/bootstrap.ts`

- [ ] **Step 1: Install Swagger module**

```
cd be
yarn add @nestjs/swagger
```

- [ ] **Step 2: Add setupSwagger helper in bootstrap.ts**

In `be/src/bootstrap.ts`, add a helper:

```ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

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
  if (env.NODE_ENV === 'production') return;  // disable in prod (or guard with basic auth in Phase 3)
  const document = buildSwaggerDocument(app);
  SwaggerModule.setup('docs', app, document, { swaggerOptions: { persistAuthorization: true } });
}
```

Then call inside `configureHttpApp`:

```ts
configureSwagger(app, env);
```

- [ ] **Step 3: Create generate-openapi.ts script**

`be/scripts/generate-openapi.ts`:

```ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildSwaggerDocument } from '../src/bootstrap';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildSwaggerDocument(app);
  const outputPath = resolve(__dirname, '..', 'dist', 'openapi.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');
  await app.close();
  console.log(`OpenAPI document written to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Add `openapi` script to package.json**

In `be/package.json` scripts:

```json
"openapi": "ts-node scripts/generate-openapi.ts"
```

- [ ] **Step 5: Boot smoke test — Swagger UI**

```
yarn start:dev
curl -I http://localhost:3000/docs
```
Expected: HTTP 200 or 301 (Swagger may redirect to `/docs/`). Browse to `http://localhost:3000/docs` in browser — UI loads with at least `/healthz`, `/readyz` endpoints listed.

- [ ] **Step 6: Boot in production mode — Swagger disabled**

```
NODE_ENV=production yarn build && NODE_ENV=production yarn start:prod
curl -I http://localhost:3000/docs
```
Expected: 404 (Swagger not mounted).

- [ ] **Step 7: Generate static openapi.json**

```
yarn openapi
ls dist/openapi.json
```
Expected: file exists, valid JSON, contains `paths`, `components`, `info.title === "Audio Stories BE"`.

```
node -e "const j=require('./dist/openapi.json'); console.log(j.info.title, Object.keys(j.paths).length+' paths')"
```

- [ ] **Step 8: Commit**

```bash
git add be/package.json be/yarn.lock be/scripts/generate-openapi.ts be/src/bootstrap.ts
git commit -m "feat(be): add Swagger UI at /docs (non-prod) and openapi.json build artifact"
```

---

## Task 8: ESLint architectural rules + dependency-cruiser

**Files:**
- Modify: `be/package.json` (add `dependency-cruiser`, add scripts)
- Modify: `be/eslint.config.mjs`
- Create: `be/.dependency-cruiser.cjs`

- [ ] **Step 1: Install dependency-cruiser**

```
cd be
yarn add -D dependency-cruiser
```

- [ ] **Step 2: Add no-restricted-imports rule for shared/ layer**

Append to `be/eslint.config.mjs`:

```mjs
  {
    files: ['src/shared/kernel/**/*.ts', 'src/shared/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@nestjs/*', '@prisma/client', 'axios', 'ioredis', 'fs', 'fs/*', 'node:fs', 'node:fs/*'], message: 'Domain/kernel layer must not depend on framework/IO.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@prisma/client'], message: 'Application layer must depend on repository ports, not Prisma directly.' },
            { group: ['**/infrastructure/**'], message: 'Application layer must not import from infrastructure.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@prisma/client'], message: 'API layer must not depend on Prisma directly.' },
            { group: ['**/infrastructure/**'], message: 'API layer must not import infrastructure adapters directly.' },
          ],
        },
      ],
    },
  },
```

> Note: these rules apply to the **new** layered modules (created in Phase 1+). Existing flat-structure modules (`stories`, `chapters`, etc.) are NOT yet in scope — rules use path patterns that match only new structure. This is intentional.

- [ ] **Step 3: Create dependency-cruiser config**

`be/.dependency-cruiser.cjs`:

```js
module.exports = {
  forbidden: [
    {
      name: 'no-shared-kernel-on-nest',
      severity: 'error',
      comment: 'shared/kernel must be framework-agnostic',
      from: { path: '^src/shared/kernel' },
      to: { path: '^(@nestjs|@prisma)' },
    },
    {
      name: 'no-domain-on-prisma',
      severity: 'error',
      comment: 'domain layer cannot import Prisma',
      from: { path: 'domain/' },
      to: { path: '^@prisma/client' },
    },
    {
      name: 'no-api-on-infrastructure',
      severity: 'error',
      comment: 'API layer must go through use-cases',
      from: { path: '/api/' },
      to: { path: '/infrastructure/' },
    },
    {
      name: 'no-application-on-infrastructure',
      severity: 'error',
      comment: 'Application must depend on ports, not infrastructure',
      from: { path: '/application/' },
      to: { path: '/infrastructure/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'info',
      from: { orphan: true, pathNot: ['\\.(spec|test)\\.ts$', '\\.d\\.ts$', 'eslint\\.config\\.mjs$', 'scripts/'] },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: './tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
```

- [ ] **Step 4: Add scripts to package.json**

In `be/package.json`:

```json
"depcruise": "depcruise --config .dependency-cruiser.cjs src",
"depcruise:graph": "depcruise --config .dependency-cruiser.cjs src --output-type dot | dot -T svg -o dependency-graph.svg"
```

- [ ] **Step 5: Run lint to verify no breakage**

```
yarn lint
```
Expected: PASS (no current file is in the new layered structure yet, so rules don't fire).

- [ ] **Step 6: Run depcruise to verify clean baseline**

```
yarn depcruise
```
Expected: 0 errors (rules only apply to layered paths, no false positives on existing flat modules).

- [ ] **Step 7: Smoke test rule fires on violation**

Create temporary fixture `be/src/shared/kernel/__fixture__/bad.ts` (will delete):

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class Bad {}
```

Run:
```
yarn lint
```
Expected: ESLint error mentioning `no-restricted-imports` with the "Domain/kernel layer must not depend on framework/IO" message.

Delete the fixture:
```
rm -r be/src/shared/kernel/__fixture__
```

Run again:
```
yarn lint
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add be/package.json be/yarn.lock be/eslint.config.mjs be/.dependency-cruiser.cjs
git commit -m "feat(be): enforce layered architecture with ESLint + dependency-cruiser"
```

---

## Task 9: Graceful shutdown

**Files:**
- Modify: `be/src/bootstrap.ts`

- [ ] **Step 1: Enable shutdown hooks**

In `be/src/bootstrap.ts`, in `bootstrap()` after creating the app/context:

```ts
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
    void app.close().then(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    Logger.log('SIGINT received, closing app...');
    void app.close().then(() => process.exit(0));
  });

  return app;
}

const appContext = await nestFactory.createApplicationContext(AppModule, { bufferLogs: true });
appContext.useLogger(appContext.get(PinoLogger));
appContext.enableShutdownHooks();

process.on('SIGTERM', () => {
  Logger.log('SIGTERM received, closing context...');
  void appContext.close().then(() => process.exit(0));
});
process.on('SIGINT', () => {
  Logger.log('SIGINT received, closing context...');
  void appContext.close().then(() => process.exit(0));
});

return appContext;
```

- [ ] **Step 2: Verify PrismaService has OnApplicationShutdown (or add it)**

Read `be/src/prisma/prisma.service.ts`. If it doesn't implement `OnModuleDestroy` or `OnApplicationShutdown` calling `this.$disconnect()`, add:

```ts
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 3: Boot smoke test — send SIGTERM**

Terminal 1:
```
yarn start:dev
```

Terminal 2:
```
ps aux | grep "nest start" | grep -v grep
kill -TERM <pid_of_nest_process>
```

Expected: Terminal 1 logs "SIGTERM received, closing app..." then exits cleanly with code 0.

- [ ] **Step 4: Boot smoke test — send SIGINT (Ctrl+C)**

Terminal 1:
```
yarn start:dev
# Press Ctrl+C
```

Expected: Logs "SIGINT received, closing app...". Exits cleanly.

- [ ] **Step 5: Run full test suite**

```
yarn jest && yarn test:e2e:auth
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add be/src/bootstrap.ts be/src/prisma/prisma.service.ts
git commit -m "feat(be): enable graceful shutdown on SIGTERM/SIGINT for all roles"
```

---

## Task 10: Dockerfile + .dockerignore

**Files:**
- Create: `be/Dockerfile`
- Create: `be/.dockerignore`

- [ ] **Step 1: Create .dockerignore**

`be/.dockerignore`:

```
node_modules
dist
.yarn/cache
.yarn/install-state.gz
.git
.env
.env.prod
*.log
coverage
test
**/__tests__
uploads
```

- [ ] **Step 2: Create multi-stage Dockerfile**

`be/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:24.16.0-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare yarn@4.15.0 --activate
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
RUN yarn install --immutable

FROM node:24.16.0-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare yarn@4.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn
COPY --from=deps /app/package.json /app/yarn.lock /app/.yarnrc.yml ./
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
COPY scripts ./scripts
RUN yarn prisma:generate
RUN yarn build
RUN yarn openapi

FROM node:24.16.0-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare yarn@4.15.0 --activate \
    && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nestjs
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nestjs:nodejs /app/package.json ./package.json
USER nestjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "dist/main.js"]
```

- [ ] **Step 3: Build the image**

```
cd be
docker build -t audio-stories-be:phase0a .
```
Expected: build succeeds. Final image listed under `docker images`.

- [ ] **Step 4: Run the container against host MySQL/Redis**

```
docker run --rm -it \
  --network host \
  --env-file .env \
  -e NODE_ENV=production \
  -p 3000:3000 \
  audio-stories-be:phase0a
```
(Or set proper DATABASE_URL/REDIS_URL pointing to host network.)

Expected: container starts, logs JSON, HTTP server listening on port 3000.

In another terminal:
```
curl -fsS http://localhost:3000/healthz
```
Expected: 200 with `{ "data": { "status": "ok" }, "meta": {...} }`.

Stop the container with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add be/Dockerfile be/.dockerignore
git commit -m "build(be): add multi-stage Dockerfile with non-root user and healthcheck"
```

---

## Task 11: docker-compose.dev.yml

**Files:**
- Create: `be/docker-compose.dev.yml`

- [ ] **Step 1: Create docker-compose.dev.yml**

`be/docker-compose.dev.yml`:

```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: audio-stories-mysql-dev
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: audio_stories_dev
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-proot"]
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: audio-stories-redis-dev
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10

  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: audio-stories-api-dev
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: development
      APP_ROLE: api
      HOST: 0.0.0.0
      PORT: 3000
      DATABASE_URL: mysql://root:root@mysql:3306/audio_stories_dev
      REDIS_URL: redis://redis:6379/0
    env_file:
      - .env
    ports:
      - "3000:3000"
    restart: unless-stopped

volumes:
  mysql-data:
  redis-data:
```

- [ ] **Step 2: Bring stack up**

```
cd be
docker compose -f docker-compose.dev.yml up --build -d
```
Expected: mysql and redis become healthy. api builds and starts.

```
docker compose -f docker-compose.dev.yml ps
```
Expected: all 3 services with status "running" / "healthy".

- [ ] **Step 3: Verify endpoints from host**

```
curl -fsS http://localhost:3000/healthz
curl -fsS http://localhost:3000/readyz
```
Expected: 200 from both. `readyz` confirms DB connection (Prisma indicator).

- [ ] **Step 4: Tear down**

```
docker compose -f docker-compose.dev.yml down -v
```

- [ ] **Step 5: Commit**

```bash
git add be/docker-compose.dev.yml
git commit -m "build(be): add docker-compose.dev.yml with MySQL + Redis + API stack"
```

---

## Task 12: GitHub Actions CI workflow

**Files:**
- Create: `be/.github/workflows/ci.yml` (or root `.github/workflows/be-ci.yml` if repo has multiple projects — confirm location)

- [ ] **Step 1: Check if root .github/workflows/ exists**

```
ls /home/thehiep/Documents/Dev-TheHiep/NetViet-Projects/audio-stories-project-all/.github/workflows/ 2>/dev/null
```
- If exists, create `be-ci.yml` there with path filter.
- If not, create `be/.github/workflows/ci.yml` (only triggered when working in BE).

For this plan, default to **root** `.github/workflows/be-ci.yml` because repo contains BE + FE.

- [ ] **Step 2: Create workflow file**

`/.github/workflows/be-ci.yml`:

```yaml
name: BE CI

on:
  push:
    branches: [master, main]
    paths:
      - 'be/**'
      - '.github/workflows/be-ci.yml'
  pull_request:
    paths:
      - 'be/**'
      - '.github/workflows/be-ci.yml'

defaults:
  run:
    working-directory: be

jobs:
  lint-typecheck-test-build:
    name: Lint, Typecheck, Test, Build
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node 24.16
        uses: actions/setup-node@v4
        with:
          node-version: 24.16.0

      - name: Enable Corepack + Yarn 4.15
        run: |
          corepack enable
          corepack prepare yarn@4.15.0 --activate

      - name: Cache Yarn
        uses: actions/cache@v4
        with:
          path: |
            be/.yarn/cache
            be/.yarn/install-state.gz
          key: ${{ runner.os }}-yarn-${{ hashFiles('be/yarn.lock') }}

      - name: Install dependencies
        run: yarn install --immutable

      - name: Generate Prisma client
        run: yarn prisma:generate

      - name: Lint
        run: yarn lint

      - name: Typecheck
        run: yarn tsc --noEmit -p tsconfig.build.json

      - name: Unit tests
        run: yarn jest --runInBand --passWithNoTests

      - name: Dependency-cruiser
        run: yarn depcruise

      - name: Build
        run: yarn build

      - name: Generate OpenAPI
        run: yarn openapi

      - name: Upload openapi.json artifact
        uses: actions/upload-artifact@v4
        with:
          name: openapi
          path: be/dist/openapi.json
          if-no-files-found: error
```

- [ ] **Step 3: Verify workflow YAML is parseable**

If `yq` or `actionlint` is available locally:
```
actionlint .github/workflows/be-ci.yml
```
Expected: 0 errors.

If neither tool installed, do a manual YAML parse:
```
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/be-ci.yml'))"
```
Expected: no exception.

- [ ] **Step 4: Push to a feature branch and confirm green run**

```
git checkout -b ci/phase-0a-foundation
git push -u origin ci/phase-0a-foundation
```
Open the GitHub Actions tab; wait for the run.
Expected: all steps green. Artifact `openapi` uploaded.

If anything fails: iterate locally on the failing step, push fix commits, repeat.

- [ ] **Step 5: Commit and merge back**

After CI passes on branch:

```bash
git add .github/workflows/be-ci.yml
git commit -m "ci(be): add Phase 0a CI workflow (lint, typecheck, test, depcruise, build, openapi)"
git checkout master
git merge --no-ff ci/phase-0a-foundation
```

(Do NOT push to master without explicit user approval if branch protection is configured; instead create a PR.)

---

## Gate G0a — verification before closing Phase 0a

After all 12 tasks merged to master, verify the gate from spec Section 8.2:

- [ ] **Verify boot fails on missing env**

```
cd be
env JWT_ACCESS_SECRET= yarn start:prod
```
Expected: exits with zod error mentioning `JWT_ACCESS_SECRET`.

- [ ] **Verify /healthz returns 200**

```
yarn start:dev &
sleep 5
curl -fsS http://localhost:3000/healthz
```
Expected: `{ "data": { "status": "ok" }, ... }`. Kill the bg process.

- [ ] **Verify /readyz returns 200 with DB check**

```
curl -fsS http://localhost:3000/readyz
```
Expected: `{ "data": { "status": "ok", "info": { "database": {...} }, ... }, "meta": {...} }`.

- [ ] **Verify Swagger UI accessible in dev**

Open `http://localhost:3000/docs` in browser. UI renders.

- [ ] **Verify error envelope on bad route**

```
curl -i http://localhost:3000/no-such-route
```
Response body: `{ "error": { "code": "NOT_FOUND", ... }, "meta": { "requestId": "..." } }`.

- [ ] **Verify CI green on master**

GitHub Actions latest run on master: all jobs green.

- [ ] **Verify Docker image builds and runs**

```
docker build -t audio-stories-be:g0a be/
docker run --rm --network host --env-file be/.env -e NODE_ENV=production audio-stories-be:g0a &
sleep 10
curl -fsS http://localhost:3000/healthz
docker stop $(docker ps -q --filter ancestor=audio-stories-be:g0a)
```

- [ ] **Verify legacy aliases are gone**

```
grep -rn "MAIL_FROM\|VIETQR_DEFAULT_TEMPLATE\|VIETQR_ACQ_ID\|R2_SECRET_KEY_ID" be/src/ be/.env.example be/.env be/.env.prod
```
Expected: 0 matches.

- [ ] **Tag the gate**

```
git tag -a phase-0a-g0a -m "Phase 0a Foundation complete; gate G0a passed"
```

---

## Next phase

After G0a passes:

- Invoke writing-plans skill again to create `2026-MM-DD-be-refactor-phase-0b-schema-split.md`.
- Phase 0b is small (~2-3 days): tách `prisma/schema.prisma` thành multi-file theo Section 3 của spec.
- After 0b passes G0b, Phase 1 (Reference module Stories) is the next plan.
