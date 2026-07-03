import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { Account } from '../../auth/decorators/account.decorator';
import { VietQRService } from '../services/vietqr.service';
import { CreateVietQROrderDto } from '../dto';

@ApiTags('VietQR')
@Controller('billing/vietqr')
export class VietQRController {
  constructor(private readonly vietqrService: VietQRService) {}

  @ApiOperation({ summary: 'Tạo đơn nạp tiền qua VietQR' })
  @Post('create-order')
  @UseGuards(JwtAccessGuard)
  @HttpCode(200)
  async createOrder(@Account() user: any, @Body() dto: CreateVietQROrderDto) {
    return this.vietqrService.createOrder({
      userId: user.sub,
      packageCode: dto.package_code,
    });
  }

  @ApiOperation({ summary: 'Tạo đơn nạp tiền VietQR (alias)' })
  @Post('order')
  @UseGuards(JwtAccessGuard)
  @HttpCode(200)
  async createOrderAlias(@Account() user: any, @Body() dto: CreateVietQROrderDto) {
    return this.vietqrService.createOrder({
      userId: user.sub,
      packageCode: dto.package_code,
    });
  }

  @ApiOperation({ summary: 'Kiểm tra trạng thái đơn nạp tiền VietQR' })
  @Get('order/:orderId/status')
  @UseGuards(JwtAccessGuard)
  async checkOrderStatus(@Param('orderId') orderId: string) {
    return this.vietqrService.checkOrderStatus(orderId);
  }
}
