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
