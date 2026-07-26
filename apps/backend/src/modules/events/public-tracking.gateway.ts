import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import type {
  PublicDriverLocationPayload,
  PublicTrackingUpdatePayload,
  RideUpdatePayload,
} from '@kansride/types';
import { PublicTrackingService } from './public-tracking.service';

interface PublicTrackingSocket extends Socket {
  data: {
    trackingRideId?: string;
    publicReference?: string;
    tokenHash?: string;
  };
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/tracking' })
export class PublicTrackingGateway
implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(PublicTrackingGateway.name);

  constructor(private readonly trackingService: PublicTrackingService) {}

  async handleConnection(client: PublicTrackingSocket): Promise<void> {
    try {
      const token = client.handshake.auth?.token;
      if (typeof token !== 'string') {
        throw new Error('Missing tracking token');
      }
      const grant = await this.trackingService.resolveToken(token);
      const tokenHash = this.trackingService.tokenHash(token);
      client.data.trackingRideId = grant.rideId;
      client.data.publicReference = grant.publicReference;
      client.data.tokenHash = tokenHash;
      await client.join(this.trackingService.roomForTokenHash(tokenHash));
    } catch {
      client.emit('tracking:error', { message: 'Tracking link is invalid or expired' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: PublicTrackingSocket): void {
    this.logger.debug(`Public tracking socket disconnected: ${client.id}`);
  }

  async emitRideUpdate(payload: RideUpdatePayload): Promise<void> {
    const tokenHashes = await this.activeTokenHashes(payload.rideId);
    for (const tokenHash of tokenHashes) {
      const update: PublicTrackingUpdatePayload = {
        publicReference: `KR-${tokenHash.slice(0, 10).toUpperCase()}`,
        status: payload.status,
        updatedAt: payload.updatedAt,
      };
      this.server
        .to(this.trackingService.roomForTokenHash(tokenHash))
        .emit('tracking:update', update);
    }

    if (this.trackingService.isTerminal(payload.status)) {
      await this.trackingService.revokeRide(payload.rideId);
      for (const tokenHash of tokenHashes) {
        this.server
          .in(this.trackingService.roomForTokenHash(tokenHash))
          .disconnectSockets(true);
      }
    }
  }

  async emitDriverLocation(
    rideId: string,
    latitude: number,
    longitude: number,
    timestamp: Date,
  ): Promise<void> {
    const tokenHashes = await this.activeTokenHashes(rideId);
    for (const tokenHash of tokenHashes) {
      const payload: PublicDriverLocationPayload = {
        publicReference: `KR-${tokenHash.slice(0, 10).toUpperCase()}`,
        latitude,
        longitude,
        timestamp: timestamp.toISOString(),
      };
      this.server
        .to(this.trackingService.roomForTokenHash(tokenHash))
        .emit('tracking:driver-location', payload);
    }
  }

  private async activeTokenHashes(rideId: string): Promise<string[]> {
    const tokenHashes = await this.trackingService.getTokenHashesForRide(rideId);
    const active: string[] = [];
    for (const tokenHash of tokenHashes) {
      if (await this.trackingService.isTokenHashActive(tokenHash)) {
        active.push(tokenHash);
      } else {
        await this.trackingService.removeExpiredTokenHash(rideId, tokenHash);
        this.server
          .in(this.trackingService.roomForTokenHash(tokenHash))
          .disconnectSockets(true);
      }
    }
    return active;
  }
}
