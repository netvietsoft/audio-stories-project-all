import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from '../services/stripe.service';
import { WebhookService } from '../services/webhook.service';

@Controller('billing/webhook/stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookService: WebhookService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      return { received: false, error: 'No raw body' };
    }

    try {
      const event = await this.stripeService.handleWebhookEvent(rawBody, signature);
      await this.webhookService.processStripeEvent(event);
      return { received: true };
    } catch (error) {
      console.error('Stripe webhook error:', error);
      return { received: false, error: (error as Error).message };
    }
  }
}
