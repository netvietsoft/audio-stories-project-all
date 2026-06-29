import { z } from 'zod';

const stringNonEmpty = z.string().trim().min(1);

const LEGACY_ALIASES = ['MAIL_FROM', 'VIETQR_DEFAULT_TEMPLATE', 'VIETQR_ACQ_ID', 'R2_SECRET_KEY_ID'] as const;

const RawEnvSchema = z
  .looseObject({
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

    // HLS audio (AES-128). Master key + public API origin are required and
    // fail-closed (red-team C3, H5): the worker has no request host, so the
    // key URI must be built from PUBLIC_API_URL.
    HLS_MASTER_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'HLS_MASTER_KEY must be 64 hex characters (32 bytes)'),
    PUBLIC_API_URL: z.url(),
    HLS_AUDIO_BITRATE: stringNonEmpty.default('128k'),
    HLS_SEGMENT_SECONDS: z.coerce.number().int().positive().default(10),

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
  runtime: {
    appRole: 'api' | 'worker' | 'scheduler';
    nodeEnv: 'development' | 'test' | 'staging' | 'production';
    host: string;
    port: number;
  };
  database: { url: string };
  redis: { url: string; host?: string; port?: number; password?: string; db?: number };
  auth: {
    jwtAccessSecret: string;
    jwtRefreshSecret: string;
    jwtAccessTtl: string;
    jwtRefreshTtl: string;
    internalApiKey: string;
  };
  cors: {
    webOrigin: string;
    adminOrigin: string;
    frontendUrl?: string;
    clientUrl?: string;
    allowedClientUrls?: string;
    raw?: string;
    cookieDomain?: string;
    cookieSameSite: 'lax' | 'strict' | 'none';
    cookieSecure: boolean;
  };
  mail: { host: string; port: number; secure: boolean; user?: string; pass?: string; from: string };
  oauth: { googleClientId?: string; googleClientSecret?: string; googleCallbackUrl?: string };
  storage: {
    provider: 'r2' | 's3' | 'uploadthing';
    uploadthingToken?: string;
    r2: {
      token?: string;
      accountId?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      bucketName?: string;
      url?: string;
      endpoint?: string;
    };
    aws: { accessKeyId?: string; secretAccessKey?: string; region?: string; bucketName?: string };
  };
  payment: {
    stripeSecretKey?: string;
    stripeWebhookSecret?: string;
    usdToVndRate?: number;
    vietqr: {
      apiUrl?: string;
      clientId?: string;
      apiKey?: string;
      accountNo?: string;
      accountName?: string;
      bankId?: string;
      template: string;
      qrFormat?: string;
      exchangeRate?: number;
      orderExpiryMinutes?: number;
    };
    casso: { apiUrl?: string; apiKey?: string; secureToken?: string; webhookUrl?: string };
  };
  admin: { email: string; password: string };
  publicApiUrl: string;
  hls: { masterKey: string; audioBitrate: string; segmentSeconds: number };
  rateLimit: { disabled: boolean };
  testing: { e2eCleanup?: string; testStorySlug?: string; testUserToken?: string; testAdminToken?: string };
}

export function parseAppConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): AppConfig {
  const raw = RawEnvSchema.parse(env);
  return {
    runtime: { appRole: raw.APP_ROLE, nodeEnv: raw.NODE_ENV, host: raw.HOST, port: raw.PORT },
    database: { url: raw.DATABASE_URL },
    redis: {
      url: raw.REDIS_URL,
      host: raw.REDIS_HOST,
      port: raw.REDIS_PORT,
      password: raw.REDIS_PASSWORD,
      db: raw.REDIS_DB,
    },
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
    publicApiUrl: raw.PUBLIC_API_URL,
    hls: {
      masterKey: raw.HLS_MASTER_KEY,
      audioBitrate: raw.HLS_AUDIO_BITRATE,
      segmentSeconds: raw.HLS_SEGMENT_SECONDS,
    },
    rateLimit: { disabled: raw.THROTTLE_DISABLED },
    testing: {
      e2eCleanup: raw.E2E_CLEANUP,
      testStorySlug: raw.TEST_STORY_SLUG,
      testUserToken: raw.TEST_USER_TOKEN,
      testAdminToken: raw.TEST_ADMIN_TOKEN,
    },
  };
}
