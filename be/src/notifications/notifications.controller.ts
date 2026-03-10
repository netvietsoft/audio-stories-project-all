import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';

import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAccessGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private userIdFromAccount(account: any) {
    return account?.id || account?.sub;
  }

  @Get()
  list(@Account() account: any, @Query() query: ListNotificationsDto) {
    return this.notificationsService.list(this.userIdFromAccount(account), query);
  }

  @Patch(':id/read')
  markRead(@Account() account: any, @Param('id') id: string) {
    return this.notificationsService.markRead(this.userIdFromAccount(account), id);
  }

  @Patch('read-all')
  markAllRead(@Account() account: any) {
    return this.notificationsService.markAllRead(this.userIdFromAccount(account));
  }
}
