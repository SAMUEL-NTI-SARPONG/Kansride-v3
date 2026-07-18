import { Controller, Get, Post, Body, Patch, UseGuards, Req } from '@nestjs/common';
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
  register(
    @Req() req: { user?: { sub?: string } },
    @Body() body: { licenseNumber: string; vehicleRegistration: string; vehicleColour: string; vehicleMake?: string; vehicleModel?: string },
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new Error('User ID not found in request');
    return this.driversService.register(userId, body);
  }

  @Post('go-online')
  @RequirePermissions('driver:go_online')
  goOnline(
    @Req() req: { user?: { sub?: string; driverId?: string } },
    @Body() body: { latitude: number; longitude: number },
  ) {
    const driverId = req.user?.driverId;
    if (!driverId) throw new Error('Driver ID not found in request');
    return this.driversService.setOnlineStatus(driverId, true, body);
  }

  @Post('go-offline')
  @RequirePermissions('driver:go_online')
  goOffline(@Req() req: { user?: { sub?: string; driverId?: string } }) {
    const driverId = req.user?.driverId;
    if (!driverId) throw new Error('Driver ID not found in request');
    return this.driversService.setOnlineStatus(driverId, false);
  }

  @Patch('location')
  @RequirePermissions('driver:go_online')
  updateLocation(
    @Req() req: { user?: { sub?: string; driverId?: string } },
    @Body() body: { latitude: number; longitude: number },
  ) {
    const driverId = req.user?.driverId;
    if (!driverId) throw new Error('Driver ID not found in request');
    return this.driversService.updateLocation(driverId, body.latitude, body.longitude);
  }

  @Post('subscribe')
  @RequirePermissions('driver:subscribe')
  subscribe(
    @Req() req: { user?: { sub?: string; driverId?: string } },
    @Body() body: { paymentMethod: string },
  ) {
    const driverId = req.user?.driverId;
    if (!driverId) throw new Error('Driver ID not found in request');
    return this.driversService.subscribe(driverId, body.paymentMethod);
  }

  @Get('me')
  getMe(@Req() req: { user?: { sub?: string; driverId?: string } }) {
    const userId = req.user?.sub;
    if (!userId) throw new Error('User ID not found in request');
    return this.driversService.getDriverProfile(userId);
  }

  @Get('earnings')
  @RequirePermissions('driver:view_earnings')
  getEarnings(@Req() req: { user?: { sub?: string; driverId?: string } }) {
    const driverId = req.user?.driverId;
    if (!driverId) throw new Error('Driver ID not found in request');
    return this.driversService.getEarnings(driverId);
  }
}
