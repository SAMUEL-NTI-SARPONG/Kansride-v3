import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { FareService } from './fare.service';
import { StateMachineService } from './state-machine.service';
import { DispatchService } from './dispatch.service';

@Module({
  controllers: [RidesController],
  providers: [RidesService, FareService, StateMachineService, DispatchService],
  exports: [RidesService, FareService, StateMachineService, DispatchService],
})
export class RidesModule {}
