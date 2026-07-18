import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DriversService } from './drivers.service';

@Controller('drivers')
@UseGuards(AuthGuard, RolesGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post('register')
  @RequirePermissions('driver:register')
  register(@Body() body: { licenseNumber: string; vehicleRegistration: string }) {
    return this.driversService.register(body);
  }

  @Post('go-online')
  @RequirePermissions('driver:go_online')
  goOnline(@Body() body: { latitude: number; longitude: number }) {
    return this.driversService.setOnlineStatus(true, body);
  }

  @Post('go-offline')
  @RequirePermissions('driver:go_online')
  goOffline() {
    return this.driversService.setOnlineStatus(false);
  }

  @Post('subscribe')
  @RequirePermissions('driver:subscribe')
  subscribe(@Body() body: { paymentMethod: string }) {
    return this.driversService.subscribe(body.paymentMethod);
  }

  @Get('earnings')
  @RequirePermissions('driver:view_earnings')
  getEarnings() {
    return this.driversService.getEarnings();
  }
}
