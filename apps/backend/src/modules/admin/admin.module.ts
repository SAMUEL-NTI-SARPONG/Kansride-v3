import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RidesModule } from '../rides/rides.module';

@Module({
  imports: [RidesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
