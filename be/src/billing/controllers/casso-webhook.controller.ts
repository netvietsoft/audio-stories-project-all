import { Controller, Post, Body, Headers, HttpCode, Logger } from '@nestjs/common';
import { VietQRService } from '../services/vietqr.service';
import { PrismaService } from '../../prisma/prisma.service';

interface CassoTransaction {
  id: number;
  tid: string;
  description: string;
  amount: number;
  cusum_balance: number;
  when: string;
  bank_sub_acc_id: string;
  subAccId: string;
  virtualAccount: string;
  virtualAccountName: string;
  corresponsiveName: string;
  corresponsiveAccount: string;
  corresponsiveBankId: string;
  corresponsiveBankName: string;
}

interface CassoWebhookPayload {
  error: number;
  data: CassoTransaction[];
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
    if (expectedToken && secureToken !== expectedToken) {
      this.logger.warn('Invalid Casso secure token');
      return { success: false, error: 'Invalid token' };
    }

    if (payload.error !== 0 || !payload.data?.length) {
      return { success: true, message: 'No transactions to process' };
    }

    const results: { tid: string; success: boolean; error?: string }[] = [];

    for (const transaction of payload.data) {
      try {
        // Store webhook event - skip if table doesn't exist
        try {
          await this.prisma.webhookEvent.upsert({
            where: {
              provider_eventId: { provider: 'casso', eventId: transaction.tid },
            },
            create: {
              provider: 'casso',
              eventType: 'transaction',
              eventId: transaction.tid,
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
          this.logger.log(`No order reference in transaction ${transaction.tid}`);
          results.push({ tid: transaction.tid, success: false, error: 'No order reference' });
          continue;
        }

        const transactionCode = `ORDER:${match[1]}`;
        const payment = await this.vietqrService.processPayment(
          transactionCode,
          transaction.amount,
          transaction.tid,
        );

        if (payment) {
          results.push({ tid: transaction.tid, success: true });
          this.logger.log(`Processed payment for order ${payment.id}`);
        } else {
          results.push({ tid: transaction.tid, success: false, error: 'Order not found or amount mismatch' });
        }

        // Mark event as processed
        try {
          await this.prisma.webhookEvent.updateMany({
            where: { eventId: transaction.tid },
            data: { processed: true, processedAt: new Date() },
          });
        } catch (e) {
          // Ignore if table doesn't exist
        }
      } catch (error) {
        this.logger.error(`Error processing transaction ${transaction.tid}:`, error);
        results.push({ tid: transaction.tid, success: false, error: (error as Error).message });
      }
    }

    return { success: true, results };
  }
}
