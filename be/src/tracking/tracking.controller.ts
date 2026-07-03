import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { TrackEventDto } from './dto/track-event.dto';
import { TrackingService } from './tracking.service';

@ApiTags('Tracking')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @ApiOperation({ summary: 'Ghi nhận lượt xem' })
  @Post('view')
  trackView(@Body() dto: TrackEventDto) {
    return this.trackingService.trackView(dto);
  }

  @ApiOperation({ summary: 'Ghi nhận lượt nghe' })
  @Post('listen')
  trackListen(@Body() dto: TrackEventDto) {
    return this.trackingService.trackListen(dto);
  }
}
