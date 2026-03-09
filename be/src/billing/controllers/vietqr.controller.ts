import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { Account } from '../../auth/decorators/account.decorator';
import { VietQRService } from '../services/vietqr.service';
import { CreateVietQROrderDto } from '../dto';

@Controller('billing/vietqr')
export class VietQRController {
  constructor(private readonly vietqrService: VietQRService) {}

  @Post('create-order')
  @UseGuards(JwtAccessGuard)
  @HttpCode(200)
  async createOrder(@Account() user: any, @Body() dto: CreateVietQROrderDto) {
    return this.vietqrService.createOrder({
      userId: user.sub,
      packageCode: dto.package_code,
    });
  }

  @Post('order')
  @UseGuards(JwtAccessGuard)
  @HttpCode(200)
  async createOrderAlias(@Account() user: any, @Body() dto: CreateVietQROrderDto) {
    return this.vietqrService.createOrder({
      userId: user.sub,
      packageCode: dto.package_code,
    });
  }

  @Get('order/:orderId/status')
  @UseGuards(JwtAccessGuard)
  async checkOrderStatus(@Param('orderId') orderId: string) {
    return this.vietqrService.checkOrderStatus(orderId);
  }
}
