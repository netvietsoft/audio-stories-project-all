import { Injectable } from '@nestjs/common';
import { AppConfig } from './app-config.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly cfg: AppConfig) {}

  get runtime() {
    return this.cfg.runtime;
  }
  get database() {
    return this.cfg.database;
  }
  get redis() {
    return this.cfg.redis;
  }
  get auth() {
    return this.cfg.auth;
  }
  get cors() {
    return this.cfg.cors;
  }
  get mail() {
    return this.cfg.mail;
  }
  get oauth() {
    return this.cfg.oauth;
  }
  get storage() {
    return this.cfg.storage;
  }
  get payment() {
    return this.cfg.payment;
  }
  get admin() {
    return this.cfg.admin;
  }
  get publicApiUrl() {
    return this.cfg.publicApiUrl;
  }
  get hls() {
    return this.cfg.hls;
  }
  get rateLimit() {
    return this.cfg.rateLimit;
  }
  get testing() {
    return this.cfg.testing;
  }
}
