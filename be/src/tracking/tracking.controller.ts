import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';

import { clientIp } from '@/common/geo/geo.util';
import { TrackEventDto } from './dto/track-event.dto';
import { TrackingService } from './tracking.service';

@ApiTags('Tracking')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @ApiOperation({ summary: 'Ghi nhận lượt xem' })
  @Post('view')
  trackView(@Body() dto: TrackEventDto, @Req() req: Request) {
    return this.trackingService.trackView(dto, clientIp(req));
  }

  @ApiOperation({ summary: 'Ghi nhận lượt nghe' })
  @Post('listen')
  trackListen(@Body() dto: TrackEventDto) {
    return this.trackingService.trackListen(dto);
  }
}
