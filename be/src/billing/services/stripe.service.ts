import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { PackagesHelperService } from './packages-helper.service';
import { MailService } from '../../mail/mail.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly packagesHelper: PackagesHelperService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
      this.logger.log('Stripe initialized');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not configured');
    }
  }

  private ensureStripe(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }
    return this.stripe;
  }

  async createCheckoutSession(params: {
    userId: string;
    packageCode: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    const stripe = this.ensureStripe();

    const pkg = await this.packagesHelper.findByCode(params.packageCode);

    if (!pkg || !pkg.isActive) {
      throw new BadRequestException('Package not found or inactive');
    }

    this.logger.log(`Found package: ${JSON.stringify(pkg)}`);

    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Get or create Stripe customer, with fallback if stored ID is invalid
    let customerId = (user as any).stripeCustomerId as string | null;

    if (customerId) {
      // Verify the customer still exists in Stripe
      try {
        await stripe.customers.retrieve(customerId);
      } catch (err: any) {
        if (err?.code === 'resource_missing') {
          this.logger.warn(`Stripe customer ${customerId} not found, creating a new one`);
          customerId = null; // Force re-creation below
          await this.prisma.user.update({
            where: { id: user.id },
            data: { stripeCustomerId: null } as any,
          });
        } else {
          throw err;
        }
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.displayName || undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId } as any,
      });
    }


    // Convert VND to USD (approximate rate)
    const exchangeRate = parseFloat(process.env.USD_TO_VND_RATE || '25000');
    const amountUsd = Math.round((pkg.priceVnd / exchangeRate) * 100); // in cents

    // Get product name and description
    const productName = pkg.name?.trim() || `${pkg.credits} Credits Package`;
    const productDescription = pkg.description?.trim() || `${pkg.credits} credits`;

    this.logger.log(`Creating Stripe session with product: ${productName}, price: ${amountUsd} cents`);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: amountUsd,
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        user_id: params.userId,
        package_code: params.packageCode,
      },
    });

    return {
      session_id: session.id,
      url: session.url,
    };
  }

  async handleWebhookEvent(payload: Buffer, signature: string) {
    const stripe = this.ensureStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new BadRequestException('Stripe webhook secret not configured');
    }

    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    // Store webhook event
    await this.prisma.webhookEvent.upsert({
      where: {
        provider_eventId: { provider: 'stripe', eventId: event.id },
      },
      create: {
        provider: 'stripe',
        eventType: event.type,
        eventId: event.id,
        payload: event.data.object as any,
      },
      update: {},
    }).catch(() => {
      // Ignore unique constraint errors
    });

    return event;
  }

  async verifyAndProcessPayment(userId: string, sessionId: string) {
    const stripe = this.ensureStripe();

    this.logger.log(`Verifying payment for user ${userId}, session ${sessionId}`);

    try {
      // Retrieve the session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      this.logger.log(`Session status: ${session.payment_status}, User from metadata: ${session.metadata?.user_id}`);

      // Verify the session belongs to this user
      if (session.metadata?.user_id !== userId) {
        throw new BadRequestException('Session does not belong to this user');
      }

      // Check if payment was successful
      if (session.payment_status !== 'paid') {
        return {
          success: false,
          message: 'Payment not completed',
          status: session.payment_status,
        };
      }

      const packageCode = session.metadata?.package_code;
      if (!packageCode) {
        throw new BadRequestException('Package code not found in session metadata');
      }

      // Check if payment already processed
      const existingPayment = await this.prisma.payment.findFirst({
        where: {
          userId: userId,
          providerPaymentId: session.payment_intent as string || session.id,
        },
      });

      if (existingPayment) {
        this.logger.log(`Payment already processed: ${existingPayment.id}`);
        return {
          success: true,
          message: 'Payment already processed',
          alreadyProcessed: true,
          payment: existingPayment,
        };
      }

      // Get package details
      const pkg = await this.packagesHelper.findByCode(packageCode);
      if (!pkg) {
        throw new BadRequestException('Package not found');
      }

      // Get user info for email
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, allowEmailNoti: true, credits: true },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      const now = new Date();
      const exchangeRate = parseFloat(process.env.USD_TO_VND_RATE || '25000');
      const amountUsd = session.amount_total ? session.amount_total / 100 : pkg.priceVnd / exchangeRate;

      this.logger.log(`Processing payment: ${pkg.credits} credits for user ${userId}`);

      // Process the payment
      await this.prisma.$transaction([
        this.prisma.payment.create({
          data: {
            userId: userId,
            packageCode: packageCode,
            providerPaymentId: session.payment_intent as string || session.id,
            providerCustomerId: session.customer as string,
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
            balanceBefore: user.credits,
            balanceAfter: user.credits + pkg.credits,
            referenceId: session.payment_intent as string || session.id,
            description: `Nạp ${pkg.credits} credits qua Stripe`,
          },
        }),
      ]);

      this.logger.log(`Payment processed successfully`);

      // Create notification
      try {
        await this.notificationsService.createPaymentNotification(
          userId,
          pkg.priceVnd,
          pkg.credits,
          session.payment_intent as string || session.id,
          'Stripe',
        );
        this.logger.log(`Notification created`);
      } catch (error) {
        this.logger.error(`Failed to create notification:`, error);
      }

      // Send email if user allows
      if (user.allowEmailNoti) {
        try {
          await this.mailService.sendPaymentSuccessEmail(
            user.email,
            pkg.priceVnd,
            pkg.credits,
            session.payment_intent as string || session.id,
            'Stripe',
          );
          this.logger.log(`Email sent to ${user.email}`);
        } catch (error) {
          this.logger.error(`Failed to send email:`, error);
        }
      }

      return {
        success: true,
        message: 'Payment processed successfully',
        creditsAdded: pkg.credits,
        newBalance: user.credits + pkg.credits,
      };
    } catch (error) {
      this.logger.error(`Failed to verify payment:`, error);
      throw error;
    }
  }
}
