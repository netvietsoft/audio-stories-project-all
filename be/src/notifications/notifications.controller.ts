import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAccessGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  @ApiOperation({ summary: 'Lấy danh sách thông báo của người dùng' })
  @Get()
  list(@Account() account: any, @Query() query: ListNotificationsDto) {
    return this.notificationsService.list(this.userIdFromAccount(account), query);
  }

  @ApiOperation({ summary: 'Đánh dấu một thông báo đã đọc' })
  @Patch(':id/read')
  markRead(@Account() account: any, @Param('id') id: string) {
    return this.notificationsService.markRead(this.userIdFromAccount(account), id);
  }

  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo đã đọc' })
  @Patch('read-all')
  markAllRead(@Account() account: any) {
    return this.notificationsService.markAllRead(this.userIdFromAccount(account));
  }
}
