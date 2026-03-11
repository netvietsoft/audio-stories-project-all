import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PackagesHelperService } from './packages-helper.service';
import { MailService } from '../../mail/mail.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly packagesHelper: PackagesHelperService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async processStripeEvent(event: any) {
    const eventType = event.type;
    const data = event.data.object;

    this.logger.log(`Processing Stripe event: ${eventType}, Event ID: ${event.id}`);
    this.logger.debug(`Event data: ${JSON.stringify(data)}`);

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
    try {
      await this.prisma.webhookEvent.updateMany({
        where: { eventId: event.id },
        data: { processed: true, processedAt: new Date() },
      });
    } catch (error) {
      this.logger.warn('Failed to mark webhook event as processed:', error);
    }
  }

  private async handleCheckoutCompleted(session: any) {
    const userId = session.metadata?.user_id;
    const packageCode = session.metadata?.package_code;

    this.logger.log(`Checkout completed - User ID: ${userId}, Package: ${packageCode}`);

    if (!userId || !packageCode) {
      this.logger.warn('Missing metadata in checkout session');
      return;
    }

    const pkg = await this.packagesHelper.findByCode(packageCode);

    if (!pkg) {
      this.logger.warn(`Package not found: ${packageCode}`);
      return;
    }

    this.logger.log(`Package found: ${pkg.name}, Credits: ${pkg.credits}`);

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

    // Get user info for email
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, allowEmailNoti: true },
    });

    this.logger.log(`Creating payment record and updating user credits...`);

    try {
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

      this.logger.log(`Payment transaction completed successfully`);

      // Create notification
      try {
        await this.notificationsService.createPaymentNotification(
          userId,
          pkg.priceVnd,
          pkg.credits,
          session.payment_intent || session.id,
          'Stripe',
        );
        this.logger.log(`Notification created`);
      } catch (error) {
        this.logger.error(`Failed to create notification:`, error);
      }

      // Send email if user allows
      if (user && user.allowEmailNoti) {
        try {
          await this.mailService.sendPaymentSuccessEmail(
            user.email,
            pkg.priceVnd,
            pkg.credits,
            session.payment_intent || session.id,
            'Stripe',
          );
          this.logger.log(`Email sent to ${user.email}`);
        } catch (error) {
          this.logger.error(`Failed to send email:`, error);
        }
      }

      this.logger.log(`Checkout completed: User ${userId} added ${pkg.credits} credits`);
    } catch (error) {
      this.logger.error(`Failed to process checkout:`, error);
      throw error;
    }
  }

  private async handlePaymentSucceeded(paymentIntent: any) {
    this.logger.log(`Payment succeeded: ${paymentIntent.id}`);
  }

  private async handlePaymentFailed(paymentIntent: any) {
    this.logger.warn(`Payment failed: ${paymentIntent.id}`);
  }
}
