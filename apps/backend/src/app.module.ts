import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { RidesModule } from './modules/rides/rides.module';
import { HealthModule } from './modules/health/health.module';
import { EventsModule } from './modules/events/events.module';
import { AdminModule } from './modules/admin/admin.module';
import { ProvidersModule } from './providers';
import { RedisModule } from './redis';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    ScheduleModule.forRoot(),
    RedisModule,
    ProvidersModule,
    AuthModule,
    UsersModule,
    DriversModule,
    RidesModule,
    HealthModule,
    EventsModule,
    AdminModule,
  ],
  // The ThrottlerModule was previously registered but never applied: no
  // APP_GUARD was set, so only the method-scoped @ThrottlerGuard on
  // verifyPassenger was active. Registering it globally makes the documented
  // 60/min default throttle apply to every route, matching
  // docs/recovery/ARCHITECTURE_NOTES.md. The method-scoped @Throttle on
  // verifyPassenger still overrides the default for that handler.
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
