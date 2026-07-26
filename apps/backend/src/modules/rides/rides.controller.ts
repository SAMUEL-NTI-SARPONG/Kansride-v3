import { BadRequestException, Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RidesService } from './rides.service';
import type { TokenPayload } from '@kansride/auth';
import type { UserRole } from '@kansride/types';

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
  constructor(private readonly ridesService: RidesService) {}

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

  @Get(':id/track')
  @Public()
  trackRide(@Param('id') id: string) {
    return this.ridesService.getTrackingData(id);
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
    rideType?: string;
  }) {
    return this.ridesService.createRide(req.user.userId, body);
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
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.ridesService.updateStatus(id, body.status);
  }

  @Post(':id/rate')
  @RequirePermissions('ride:rate')
  rateRide(@Param('id') id: string, @Request() req: AuthenticatedRequest, @Body() body: { rating: number; comment?: string }) {
    return this.ridesService.rateRide(id, req.user.userId, req.user.role as UserRole, body.rating, body.comment);
  }
}
