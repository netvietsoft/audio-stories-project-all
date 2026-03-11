import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  Get,
  Query,
} from '@nestjs/common';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { Account } from '../../auth/decorators/account.decorator';
import { StripeService } from '../services/stripe.service';
import { CreateCheckoutSessionDto } from '../dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('create-checkout-session')
  @UseGuards(JwtAccessGuard)
  @HttpCode(200)
  async createCheckoutSession(
    @Account() user: any,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const successUrl = dto.success_url || `${baseUrl}/topup/success`;
    const cancelUrl = dto.cancel_url || `${baseUrl}/topup`;

    return this.stripeService.createCheckoutSession({
      userId: user.sub,
      packageCode: dto.package_code,
      successUrl,
      cancelUrl,
    });
  }

  @Get('verify-payment')
  @UseGuards(JwtAccessGuard)
  async verifyPayment(
    @Account() user: any,
    @Query('session_id') sessionId: string,
  ) {
    return this.stripeService.verifyAndProcessPayment(user.sub, sessionId);
  }
}
