import { Module, Provider } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HLS_BULL_PREFIX, HLS_TRANSCODE_QUEUE } from './hls.constants';
import { HlsKeyService } from './hls-key.service';
import { HlsQueueService } from './hls-queue.service';
import { HlsTranscodeService } from './hls-transcode.service';
import { HlsR2Service } from './hls-r2.service';
import { HlsProcessor } from './hls.processor';
import { HlsController } from './hls.controller';
import { HlsAccessService } from './hls-access.service';
import { HlsReconcileService } from './hls-reconcile.service';

// The transcode CONSUMER runs only in the worker role; producer + services are
// available everywhere so the api role can enqueue (red-team C5).
const isWorker = process.env.APP_ROLE === 'worker';
const workerProviders: Provider[] = isWorker ? [HlsProcessor] : [];

@Module({
  imports: [
    BullModule.registerQueue({
      name: HLS_TRANSCODE_QUEUE,
      prefix: HLS_BULL_PREFIX, // isolate keys from the shared cache Redis (H4)
    }),
  ],
  controllers: [HlsController],
  providers: [
    HlsKeyService,
    HlsQueueService,
    HlsTranscodeService,
    HlsR2Service,
    HlsAccessService,
    HlsReconcileService,
    ...workerProviders,
  ],
  exports: [HlsQueueService, HlsKeyService],
})
export class HlsModule {}
