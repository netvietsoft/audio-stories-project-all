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
              'req.headers["x-refresh-token"]',
              'req.body.password',
              'req.body.newPassword',
              'req.body.refreshToken',
              'req.body.accessToken',
              'req.body.token',
              'req.body.code',
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
