import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PackagesHelperService } from './packages-helper.service';

interface PayPalAccessToken {
  access_token: string;
  expires_in: number;
}

@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly packagesHelper: PackagesHelperService,
  ) {}

  private get baseUrl(): string {
    return process.env.PAYPAL_MODE === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  private get isConfigured(): boolean {
    return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  }

  private async getAccessToken(): Promise<string> {
    if (!this.isConfigured) {
      throw new BadRequestException('PayPal is not configured');
    }

    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
    ).toString('base64');

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to get PayPal access token');
    }

    const data: PayPalAccessToken = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

    return this.accessToken;
  }

  async createOrder(params: { userId: string; packageCode: string }) {
    const token = await this.getAccessToken();

    const pkg = await this.packagesHelper.findByCode(params.packageCode);

    if (!pkg || !pkg.isActive) {
      throw new BadRequestException('Package not found or inactive');
    }

    // Convert VND to USD
    const exchangeRate = parseFloat(process.env.USD_TO_VND_RATE || '25000');
    const amountUsd = (pkg.priceVnd / exchangeRate).toFixed(2);

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: amountUsd,
            },
            description: `${pkg.name} - ${pkg.credits} credits`,
            custom_id: JSON.stringify({
              user_id: params.userId,
              package_code: params.packageCode,
            }),
          },
        ],
        application_context: {
          brand_name: 'Story App',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`PayPal create order failed: ${error}`);
      throw new BadRequestException('Failed to create PayPal order');
    }

    const order = await response.json();

    // Find approval URL from links
    const approvalLink = order.links?.find(
      (link: { rel: string; href: string }) => link.rel === 'approve',
    );

    return {
      order_id: order.id,
      status: order.status,
      links: order.links,
      approval_url: approvalLink?.href || null,
    };
  }

  async captureOrder(orderId: string) {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`PayPal capture order failed: ${error}`);
      throw new BadRequestException('Failed to capture PayPal order');
    }

    const result = await response.json();

    // Process the payment if successful
    if (result.status === 'COMPLETED') {
      const customId = result.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id;
      if (customId) {
        try {
          const { user_id, package_code } = JSON.parse(customId);
          await this.activateCredits(user_id, package_code, orderId);
        } catch (e) {
          this.logger.error('Failed to parse custom_id', e);
        }
      }
    }

    return result;
  }

  private async activateCredits(userId: string, packageCode: string, paypalOrderId: string) {
    const pkg = await this.packagesHelper.findByCode(packageCode);

    if (!pkg) return;

    const now = new Date();
    const exchangeRate = parseFloat(process.env.USD_TO_VND_RATE || '25000');
    const amountUsd = pkg.priceVnd / exchangeRate;

    await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          userId: userId,
          packageCode: packageCode,
          providerPaymentId: paypalOrderId,
          status: 'SUCCESS',
          currency: 'USD',
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
          referenceId: paypalOrderId,
          description: `Nạp ${pkg.credits} credits qua PayPal`,
        },
      }),
    ]);

    this.logger.log(`Activated credits for user ${userId} via PayPal`);
  }

  async verifyWebhookSignature(headers: Record<string, string>, body: string): Promise<boolean> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      this.logger.warn('PAYPAL_WEBHOOK_ID not configured');
      return false;
    }

    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      }),
    });

    if (!response.ok) return false;

    const result = await response.json();
    return result.verification_status === 'SUCCESS';
  }
}
