import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';

// Controllers
import { BillingController } from './controllers/billing.controller';
import { StripeWebhookController } from './controllers/stripe-webhook.controller';
import { PayPalController } from './controllers/paypal.controller';
import { VietQRController } from './controllers/vietqr.controller';
import { CassoWebhookController } from './controllers/casso-webhook.controller';

// Services
import { StripeService } from './services/stripe.service';
import { PayPalService } from './services/paypal.service';
import { VietQRService } from './services/vietqr.service';
import { WebhookService } from './services/webhook.service';
import { PackagesHelperService } from './services/packages-helper.service';

@Module({
  imports: [PrismaModule, MailModule, NotificationsModule],
  controllers: [
    BillingController,
    StripeWebhookController,
    PayPalController,
    VietQRController,
    CassoWebhookController,
  ],
  providers: [
    StripeService,
    PayPalService,
    VietQRService,
    WebhookService,
    PackagesHelperService,
  ],
  exports: [StripeService, PayPalService, VietQRService],
})
export class BillingModule {}
