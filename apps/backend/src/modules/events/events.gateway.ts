import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/rides' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('driver:location')
  handleDriverLocation(@ConnectedSocket() client: Socket, @MessageBody() data: { latitude: number; longitude: number }) {
    this.logger.debug(`Driver location update from ${client.id}`);
    // TODO: Update Redis, broadcast to ride passenger
    return { event: 'ack', data: { received: true } };
  }

  @SubscribeMessage('ride:subscribe')
  handleRideSubscribe(@ConnectedSocket() client: Socket, @MessageBody() data: { rideId: string }) {
    client.join(`ride:${data.rideId}`);
    return { event: 'ack', data: { subscribed: data.rideId } };
  }

  emitRideUpdate(rideId: string, update: any) {
    this.server.to(`ride:${rideId}`).emit('ride:update', update);
  }
}
