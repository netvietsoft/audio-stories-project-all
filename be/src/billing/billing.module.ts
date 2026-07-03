import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';

// Controllers
import { BillingController } from './controllers/billing.controller';
import { StripeWebhookController } from './controllers/stripe-webhook.controller';
import { VietQRController } from './controllers/vietqr.controller';
import { CassoWebhookController } from './controllers/casso-webhook.controller';

// Services
import { StripeService } from './services/stripe.service';
import { VietQRService } from './services/vietqr.service';
import { WebhookService } from './services/webhook.service';
import { PackagesHelperService } from './services/packages-helper.service';

@Module({
  imports: [PrismaModule, MailModule, NotificationsModule],
  controllers: [
    BillingController,
    StripeWebhookController,
    VietQRController,
    CassoWebhookController,
  ],
  providers: [
    StripeService,
    VietQRService,
    WebhookService,
    PackagesHelperService,
  ],
  exports: [StripeService, VietQRService],
})
export class BillingModule {}
