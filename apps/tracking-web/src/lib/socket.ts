import { io, Socket } from 'socket.io-client';
import type {
  PublicDriverLocationPayload,
  PublicTrackingUpdatePayload,
} from '@kansride/types';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const NAMESPACE = '/tracking';

let socket: Socket | null = null;

export function connectTracking(trackingToken: string): Socket {
  disconnect();
  socket = io(`${SOCKET_URL}${NAMESPACE}`, {
    transports: ['websocket', 'polling'],
    auth: { token: trackingToken },
  });
  return socket;
}

export function onLocationUpdate(
  callback: (data: PublicDriverLocationPayload) => void,
): () => void {
  socket?.on('tracking:driver-location', callback);
  return () => socket?.off('tracking:driver-location', callback);
}

export function onRideUpdate(
  callback: (data: PublicTrackingUpdatePayload) => void,
): () => void {
  socket?.on('tracking:update', callback);
  return () => socket?.off('tracking:update', callback);
}

export function disconnect(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
