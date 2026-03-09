import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  Headers,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { Account } from '../../auth/decorators/account.decorator';
import { PayPalService } from '../services/paypal.service';
import { CreatePayPalOrderDto, CapturePayPalOrderDto } from '../dto';

@Controller('billing/paypal')
export class PayPalController {
  constructor(private readonly paypalService: PayPalService) {}

  @Post('create-order')
  @UseGuards(JwtAccessGuard)
  @HttpCode(200)
  async createOrder(@Account() user: any, @Body() dto: CreatePayPalOrderDto) {
    return this.paypalService.createOrder({
      userId: user.sub,
      packageCode: dto.package_code,
    });
  }

  @Post('order')
  @UseGuards(JwtAccessGuard)
  @HttpCode(200)
  async createOrderAlias(@Account() user: any, @Body() dto: CreatePayPalOrderDto) {
    return this.paypalService.createOrder({
      userId: user.sub,
      packageCode: dto.package_code,
    });
  }

  @Post('capture-order')
  @UseGuards(JwtAccessGuard)
  @HttpCode(200)
  async captureOrder(@Body() dto: CapturePayPalOrderDto) {
    return this.paypalService.captureOrder(dto.order_id);
  }

  @Post('capture')
  @UseGuards(JwtAccessGuard)
  @HttpCode(200)
  async captureOrderAlias(@Body() dto: CapturePayPalOrderDto) {
    return this.paypalService.captureOrder(dto.order_id);
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
    @Body() body: any,
  ) {
    const isValid = await this.paypalService.verifyWebhookSignature(
      headers,
      JSON.stringify(body),
    );

    if (!isValid) {
      console.warn('Invalid PayPal webhook signature');
      return { received: false };
    }

    console.log('PayPal webhook event:', body.event_type);
    return { received: true };
  }
}
