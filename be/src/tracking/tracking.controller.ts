import { Body, Controller, Post } from '@nestjs/common';

import { TrackEventDto } from './dto/track-event.dto';
import { TrackingService } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('view')
  trackView(@Body() dto: TrackEventDto) {
    return this.trackingService.trackView(dto);
  }

  @Post('listen')
  trackListen(@Body() dto: TrackEventDto) {
    return this.trackingService.trackListen(dto);
  }
}
