import { Module, forwardRef } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { RidesModule } from '../rides/rides.module';

@Module({
  imports: [forwardRef(() => RidesModule)],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
