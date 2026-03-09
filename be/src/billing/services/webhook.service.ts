import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PackagesHelperService } from './packages-helper.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly packagesHelper: PackagesHelperService,
  ) {}

  async processStripeEvent(event: any) {
    const eventType = event.type;
    const data = event.data.object;

    this.logger.log(`Processing Stripe event: ${eventType}`);

    switch (eventType) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(data);
        break;

      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(data);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(data);
        break;

      default:
        this.logger.log(`Unhandled Stripe event: ${eventType}`);
    }

    // Mark event as processed
    await this.prisma.webhookEvent.updateMany({
      where: { eventId: event.id },
      data: { processed: true, processedAt: new Date() },
    }).catch(() => {
      // Ignore errors
    });
  }

  private async handleCheckoutCompleted(session: any) {
    const userId = session.metadata?.user_id;
    const packageCode = session.metadata?.package_code;

    if (!userId || !packageCode) {
      this.logger.warn('Missing metadata in checkout session');
      return;
    }

    const pkg = await this.packagesHelper.findByCode(packageCode);

    if (!pkg) {
      this.logger.warn(`Package not found: ${packageCode}`);
      return;
    }

    // Check if payment already exists
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        userId: userId,
        providerPaymentId: session.payment_intent || session.id,
      },
    });

    if (existingPayment) {
      this.logger.log(`Payment already processed: ${existingPayment.id}`);
      return;
    }

    const now = new Date();
    const exchangeRate = parseFloat(process.env.USD_TO_VND_RATE || '25000');
    const amountUsd = session.amount_total ? session.amount_total / 100 : pkg.priceVnd / exchangeRate;

    await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          userId: userId,
          packageCode: packageCode,
          providerPaymentId: session.payment_intent || session.id,
          providerCustomerId: session.customer,
          status: 'SUCCESS',
          currency: session.currency?.toUpperCase() || 'USD',
          amountVnd: pkg.priceVnd,
          amountUsd: amountUsd,
          creditsAdded: pkg.credits,
          paidAt: now,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          credits: { increment: pkg.credits },
        },
      }),
      this.prisma.creditTransaction.create({
        data: {
          userId: userId,
          type: 'topup',
          amount: pkg.credits,
          balanceBefore: 0,
          balanceAfter: 0,
          referenceId: session.payment_intent || session.id,
          description: `Nạp ${pkg.credits} credits qua Stripe`,
        },
      }),
    ]);

    this.logger.log(`Checkout completed: User ${userId} added ${pkg.credits} credits`);
  }

  private async handlePaymentSucceeded(paymentIntent: any) {
    this.logger.log(`Payment succeeded: ${paymentIntent.id}`);
  }

  private async handlePaymentFailed(paymentIntent: any) {
    this.logger.warn(`Payment failed: ${paymentIntent.id}`);
  }
}
