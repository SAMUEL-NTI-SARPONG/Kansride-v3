import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { FareService } from './fare.service';
import { StateMachineService } from './state-machine.service';

@Module({
  controllers: [RidesController],
  providers: [RidesService, FareService, StateMachineService],
  exports: [RidesService, FareService, StateMachineService],
})
export class RidesModule {}
