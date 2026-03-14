import { Controller, Post, Body, Headers, HttpCode, Logger, Query, BadRequestException } from '@nestjs/common';
import { VietQRService } from '../services/vietqr.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

interface CassoTransaction {
  id: number;
  reference: string;
  description: string;
  amount: number;
  runningBalance: number;
  transactionDateTime: string;
  accountNumber: string;
  bankName: string;
  bankAbbreviation: string;
  virtualAccountNumber: string;
  virtualAccountName: string;
  counterAccountName: string;
  counterAccountNumber: string;
  counterAccountBankId: string;
  counterAccountBankName: string;
}

interface CassoWebhookPayload {
  error: number;
  data: CassoTransaction;
}

@Controller('billing/webhook/casso')
export class CassoWebhookController {
  private readonly logger = new Logger(CassoWebhookController.name);

  constructor(
    private readonly vietqrService: VietQRService,
    private readonly prisma: PrismaService,
  ) {}

  private verifySignature(signature: string, payload: string, secret: string): boolean {
    try {
      // Parse signature: t=timestamp,v1=hash
      const parts = signature.split(',');
      const timestamp = parts[0]?.split('=')[1];
      const hash = parts[1]?.split('=')[1];

      if (!timestamp || !hash) {
        this.logger.warn('Invalid signature format');
        return false;
      }

      // Create signed payload: timestamp.payload
      const signedPayload = `${timestamp}.${payload}`;

      // Compute HMAC SHA-512
      const expectedHash = crypto
        .createHmac('sha512', secret)
        .update(signedPayload)
        .digest('hex');

      // Compare hashes
      return crypto.timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(expectedHash)
      );
    } catch (error) {
      this.logger.error('Error verifying signature:', error);
      return false;
    }
  }

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Headers('x-casso-signature') cassoSignature: string,
    @Body() payload: CassoWebhookPayload,
  ) {
    this.logger.log(`Received webhook request`);
    this.logger.log(`Signature: ${cassoSignature}`);
    this.logger.log(`Payload: ${JSON.stringify(payload)}`);

    // Verify signature using secure token as secret
    const secret = process.env.CASSO_SECURE_TOKEN;
    if (!secret) {
      this.logger.error('CASSO_SECURE_TOKEN not configured');
      return { success: false, error: 'Server configuration error' };
    }

    if (!cassoSignature) {
      this.logger.warn('No signature provided');
      return { success: false, error: 'No signature' };
    }

    const payloadString = JSON.stringify(payload);
    const isValid = this.verifySignature(cassoSignature, payloadString, secret);

    this.logger.log(`Signature valid: ${isValid}`);

    if (!isValid) {
      this.logger.warn('Invalid Casso signature');
      return { success: false, error: 'Invalid signature' };
    }

    if (payload.error !== 0 || !payload.data) {
      return { success: true, message: 'No transaction to process' };
    }

    const transaction = payload.data;
    const transactionId = transaction.reference || transaction.id.toString();

    try {
      // Store webhook event - skip if table doesn't exist
      try {
        await this.prisma.webhookEvent.upsert({
          where: {
            provider_eventId: { provider: 'casso', eventId: transactionId },
          },
          create: {
            provider: 'casso',
            eventType: 'transaction',
            eventId: transactionId,
            payload: transaction as any,
          },
          update: {},
        });
      } catch (e) {
        this.logger.warn('WebhookEvent table not available, skipping storage');
      }

      // Extract order info from description
      const match = transaction.description.match(/ORDER:([A-Z0-9]+)/i);
      if (!match) {
        this.logger.log(`No order reference in transaction ${transactionId}`);
        return { success: false, error: 'No order reference' };
      }

      const transactionCode = `ORDER:${match[1]}`;
      const payment = await this.vietqrService.processPayment(
        transactionCode,
        transaction.amount,
        transactionId,
      );

      if (payment) {
        this.logger.log(`Processed payment for order ${payment.id}`);
        
        // Mark event as processed
        try {
          await this.prisma.webhookEvent.updateMany({
            where: { eventId: transactionId },
            data: { processed: true, processedAt: new Date() },
          });
        } catch (e) {
          // Ignore if table doesn't exist
        }
        
        return { success: true, message: 'Payment processed successfully' };
      } else {
        return { success: false, error: 'Order not found or amount mismatch' };
      }
    } catch (error) {
      this.logger.error(`Error processing transaction ${transactionId}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }
}
