import { Controller, Post, Body, Headers, HttpCode, Logger } from '@nestjs/common';
import { VietQRService } from '../services/vietqr.service';
import { PrismaService } from '../../prisma/prisma.service';

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

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Headers('secure-token') secureToken: string,
    @Body() payload: CassoWebhookPayload,
  ) {
    // Verify secure token
    const expectedToken = process.env.CASSO_SECURE_TOKEN;
    
    // Log for debugging
    this.logger.log(`Received webhook request`);
    this.logger.log(`Expected token: ${expectedToken}`);
    this.logger.log(`Received token: ${secureToken}`);
    this.logger.log(`Tokens match: ${secureToken === expectedToken}`);
    this.logger.log(`Payload: ${JSON.stringify(payload)}`);
    
    if (expectedToken && secureToken !== expectedToken) {
      this.logger.warn('Invalid Casso secure token');
      return { success: false, error: 'Invalid token' };
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
