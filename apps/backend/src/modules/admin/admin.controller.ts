import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { TokenPayload } from '@kansride/auth';

interface AuthenticatedRequest extends Request {
  user: TokenPayload & { iat: number; exp: number };
}

/**
 * Administrative endpoints expose aggregated/dimensional operational data
 * (dashboard stats, driver/ride/user/subscription listings) and must only
 * be reachable by authenticated administrative roles.
 *
 * - Controller-level @UseGuards(AuthGuard, RolesGuard): AuthGuard enforces a
 *   valid access token and attaches the JWT payload to the request;
 *   RolesGuard enforces the method-level @RequirePermissions metadata below.
 * - Permissions are applied per-route (least privilege): each GET endpoint
 *   requires the single narrowest permission for the resource it exposes,
 *   so a role that has admin:view_analytics (e.g. finance_officer, auditor)
 *   does NOT automatically gain access to /admin/users, /admin/drivers,
 *   /admin/rides, or /admin/subscriptions. The exact route-to-permission
 *   mapping is:
 *     GET /admin/dashboard      -> admin:view_analytics
 *     GET /admin/drivers        -> admin:manage_drivers
 *     GET /admin/rides          -> ride:view_all
 *     GET /admin/users          -> admin:manage_users
 *     GET /admin/subscriptions  -> admin:manage_subscriptions
 *   Endpoint business logic is unchanged.
 *
 * Admin login is handled by the existing phone-OTP flow (Option A):
 * a pre-provisioned admin user authenticates via POST /auth/request-otp and
 * POST /auth/verify-otp; that flow preserves their existing role, issues a
 * JWT with role=admin, and does not create a passenger row for non-passenger
 * roles. No admin-specific login endpoint is added in Task 1c.
 */
@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @RequirePermissions('admin:view_analytics')
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('drivers')
  @RequirePermissions('admin:manage_drivers')
  getDrivers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getDrivers(
      Number(page) || 1,
      Number(limit) || 20,
      status,
    );
  }

  @Get('rides')
  @RequirePermissions('ride:view_all')
  getRides(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getRides(
      Number(page) || 1,
      Number(limit) || 20,
      status,
    );
  }

  @Get('users')
  @RequirePermissions('admin:manage_users')
  getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getUsers(
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Get('subscriptions')
  @RequirePermissions('admin:manage_subscriptions')
  getSubscriptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getSubscriptions(
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Post('drivers/:id/approve')
  @RequirePermissions('admin:manage_drivers')
  approveDriver(
    @Param('id', new ParseUUIDPipe()) driverId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.adminService.approveDriver(driverId, req.user.userId);
  }

  @Post('drivers/:id/reject')
  @RequirePermissions('admin:manage_drivers')
  rejectDriver(
    @Param('id', new ParseUUIDPipe()) driverId: string,
    @Request() req: AuthenticatedRequest,
    @Body() body: { reason?: string },
  ) {
    return this.adminService.rejectDriver(driverId, req.user.userId, body.reason);
  }

  @Patch('users/:id/status')
  @RequirePermissions('admin:manage_users')
  updateUserStatus(
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Request() req: AuthenticatedRequest,
    @Body() body: { status: 'active' | 'suspended' },
  ) {
    return this.adminService.updateUserStatus(userId, body.status, req.user.userId);
  }

  @Patch('rides/:id/cancel')
  @RequirePermissions('ride:cancel')
  cancelRide(
    @Param('id', new ParseUUIDPipe()) rideId: string,
    @Request() req: AuthenticatedRequest,
    @Body() body: { reason?: string },
  ) {
    return this.adminService.cancelRide(rideId, req.user.userId, req.user.role as Parameters<AdminService['cancelRide']>[2], body.reason);
  }
}
