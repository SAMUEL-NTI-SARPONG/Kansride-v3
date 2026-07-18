import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RidesService } from './rides.service';

@Controller('rides')
@UseGuards(AuthGuard, RolesGuard)
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  @RequirePermissions('ride:create')
  createRide(@Request() req: any, @Body() body: {
    pickupLatitude: number;
    pickupLongitude: number;
    pickupAddress?: string;
    dropoffLatitude: number;
    dropoffLongitude: number;
    dropoffAddress?: string;
    rideType?: string;
  }) {
    return this.ridesService.createRide(req.user.userId, body);
  }

  @Get(':id')
  @RequirePermissions('ride:view')
  getRide(@Param('id') id: string) {
    return this.ridesService.getRide(id);
  }

  @Patch(':id/cancel')
  @RequirePermissions('ride:cancel')
  cancelRide(@Param('id') id: string, @Request() req: any, @Body() body: { reason?: string }) {
    return this.ridesService.cancelRide(id, req.user.userId, body.reason);
  }

  @Patch(':id/status')
  @RequirePermissions('ride:update_status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.ridesService.updateStatus(id, body.status);
  }

  @Post(':id/rate')
  rateRide(@Param('id') id: string, @Body() body: { rating: number; comment?: string }) {
    return this.ridesService.rateRide(id, body.rating, body.comment);
  }
}
