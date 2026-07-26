import { Controller, Get, Post, Body, Patch, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DriversService } from './drivers.service';
import type { TokenPayload } from '@kansride/auth';

/**
 * Shape of the authenticated request populated by AuthGuard. AuthGuard sets
 * `request.user` to the verified JWT access-token payload
 * (`TokenPayload & { iat; exp }`). The JWT payload contains only
 * `{ userId, phoneNumber, role }` - there is NO `sub` and NO `driverId`
 * field. Driver-domain operations that require `drivers.id` MUST resolve it
 * through `DriversService` by looking up the `drivers` row on
 * `drivers.userId = req.user.userId`; the controller must never receive a
 * `driverId` from the JWT.
 */
type AuthenticatedRequest = Request & {
  user: TokenPayload & { iat: number; exp: number };
};

@Controller('drivers')
@UseGuards(AuthGuard, RolesGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post('register')
  @RequirePermissions('driver:register')
  register(
    @Req() req: AuthenticatedRequest,
    @Body() body: {
      firstName: string;
      lastName?: string;
      licenseNumber: string;
      vehicleRegistration: string;
      vehicleColour: string;
      vehicleMake: string;
      vehicleModel: string;
    },
  ) {
    const authenticatedUserId = req.user.userId;
    return this.driversService.register(authenticatedUserId, body);
  }

  @Post('go-online')
  @RequirePermissions('driver:go_online')
  goOnline(
    @Req() req: AuthenticatedRequest,
    @Body() body: { latitude: number; longitude: number },
  ) {
    const authenticatedUserId = req.user.userId;
    return this.driversService.goOnlineByUserId(authenticatedUserId, body);
  }

  @Post('go-offline')
  @RequirePermissions('driver:go_online')
  goOffline(@Req() req: AuthenticatedRequest) {
    const authenticatedUserId = req.user.userId;
    return this.driversService.goOfflineByUserId(authenticatedUserId);
  }

  @Patch('location')
  @RequirePermissions('driver:go_online')
  updateLocation(
    @Req() req: AuthenticatedRequest,
    @Body() body: { latitude: number; longitude: number },
  ) {
    const authenticatedUserId = req.user.userId;
    return this.driversService.updateLocationByUserId(authenticatedUserId, body.latitude, body.longitude);
  }

  @Post('subscribe')
  @RequirePermissions('driver:subscribe')
  subscribe(
    @Req() req: AuthenticatedRequest,
    @Body() body: { paymentMethod: string },
  ) {
    const authenticatedUserId = req.user.userId;
    return this.driversService.subscribeByUserId(authenticatedUserId, body.paymentMethod);
  }

  @Get('me')
  getMe(@Req() req: AuthenticatedRequest) {
    const authenticatedUserId = req.user.userId;
    return this.driversService.getDriverProfile(authenticatedUserId);
  }

  @Get('earnings')
  @RequirePermissions('driver:view_earnings')
  getEarnings(@Req() req: AuthenticatedRequest) {
    const authenticatedUserId = req.user.userId;
    return this.driversService.getEarningsByUserId(authenticatedUserId);
  }
}
