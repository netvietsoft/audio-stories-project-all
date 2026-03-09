import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { PackagesHelperService } from './packages-helper.service';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly packagesHelper: PackagesHelperService,
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

    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Get or create Stripe customer
    let customerId = (user as any).stripeCustomerId;
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

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: pkg.name,
              description: `${pkg.credits} credits`,
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
}
