import { Module, forwardRef } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { RidesModule } from '../rides/rides.module';
import { PublicTrackingGateway } from './public-tracking.gateway';
import { PublicTrackingService } from './public-tracking.service';

@Module({
  imports: [forwardRef(() => RidesModule)],
  providers: [EventsGateway, PublicTrackingGateway, PublicTrackingService],
  exports: [EventsGateway, PublicTrackingService],
})
export class EventsModule {}
