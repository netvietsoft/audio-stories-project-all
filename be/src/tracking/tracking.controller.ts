import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';

import { clientIp } from '@/common/geo/geo.util';
import { TrackEventDto } from './dto/track-event.dto';
import { SearchOpenDto } from './dto/search-open.dto';
import { TrackingService } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('view')
  trackView(@Body() dto: TrackEventDto, @Req() req: Request) {
    return this.trackingService.trackView(dto, clientIp(req));
  }

  @Post('listen')
  trackListen(@Body() dto: TrackEventDto) {
    return this.trackingService.trackListen(dto);
  }

  @Post('search-open')
  trackSearchOpen(@Body() dto: SearchOpenDto, @Req() req: Request) {
    return this.trackingService.trackSearchOpen(dto, clientIp(req));
  }
}
