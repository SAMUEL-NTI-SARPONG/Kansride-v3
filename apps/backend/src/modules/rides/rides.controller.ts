import { BadRequestException, Controller, Delete, Get, Post, Patch, Body, Param, Query, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RidesService } from './rides.service';
import type { TokenPayload } from '@kansride/auth';
import type { RideType, UserRole } from '@kansride/types';
import { PublicTrackingService } from '../events/public-tracking.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

interface AuthenticatedRequest extends Request {
  user: TokenPayload & { iat: number; exp: number };
}

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;
const MAX_HISTORY_OFFSET = 10_000;

function parseBoundedInteger(
  value: string | undefined,
  name: 'limit' | 'offset',
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return defaultValue;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new BadRequestException(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }

  return parsed;
}

@Controller('rides')
@UseGuards(AuthGuard, RolesGuard)
export class RidesController {
  constructor(
    private readonly ridesService: RidesService,
    private readonly publicTrackingService: PublicTrackingService,
  ) {}

  @Get('my-rides')
  @RequirePermissions('ride:view')
  getMyRides(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ridesService.getRideHistory(
      req.user.userId,
      req.user.role as UserRole,
      {
        limit: parseBoundedInteger(
          limit,
          'limit',
          DEFAULT_HISTORY_LIMIT,
          1,
          MAX_HISTORY_LIMIT,
        ),
        offset: parseBoundedInteger(offset, 'offset', 0, 0, MAX_HISTORY_OFFSET),
      },
    );
  }

  @Get('public-track/:token')
  @Public()
  trackRide(@Param('token') token: string) {
    return this.publicTrackingService.getSnapshot(token);
  }

  @Post()
  @RequirePermissions('ride:create')
  createRide(@Request() req: AuthenticatedRequest, @Body() body: {
    pickupLatitude: number;
    pickupLongitude: number;
    pickupAddress?: string;
    dropoffLatitude: number;
    dropoffLongitude: number;
    dropoffAddress?: string;
    rideType?: RideType;
  }) {
    return this.ridesService.createRide(req.user.userId, body);
  }

  @Post(':id/tracking-link')
  @RequirePermissions('ride:view')
  createTrackingLink(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.publicTrackingService.createLink(
      id,
      req.user.userId,
      req.user.role,
    );
  }

  @Delete(':id/tracking-links')
  @RequirePermissions('ride:view')
  revokeTrackingLinks(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.publicTrackingService.revokeForOwner(
      id,
      req.user.userId,
      req.user.role,
    );
  }

  @Get(':id')
  @RequirePermissions('ride:view')
  getRide(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.ridesService.getRideForActor(
      id,
      req.user.userId,
      req.user.role as UserRole,
    );
  }

  @Patch(':id/cancel')
  @RequirePermissions('ride:cancel')
  cancelRide(@Param('id') id: string, @Request() req: AuthenticatedRequest, @Body() body: { reason?: string }) {
    return this.ridesService.cancelRide(id, req.user.userId, req.user.role as UserRole, body.reason);
  }

  @Patch(':id/status')
  @RequirePermissions('ride:update_status')
  updateStatus(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() body: { status: string },
  ) {
    return this.ridesService.updateStatus(
      id,
      body.status,
      req.user.userId,
      req.user.role as UserRole,
    );
  }

  @Post(':id/verify-passenger')
  @RequirePermissions('ride:update_status')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  verifyPassenger(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req: AuthenticatedRequest,
    @Body() body: { verificationPin: string },
  ) {
    return this.ridesService.verifyPassenger(
      id,
      body.verificationPin,
      req.user.userId,
      req.user.role as UserRole,
    );
  }

  @Post(':id/rate')
  @RequirePermissions('ride:rate')
  rateRide(@Param('id') id: string, @Request() req: AuthenticatedRequest, @Body() body: { rating: number; comment?: string }) {
    return this.ridesService.rateRide(id, req.user.userId, req.user.role as UserRole, body.rating, body.comment);
  }
}
