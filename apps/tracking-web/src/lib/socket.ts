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

// The backend emits 'tracking:error' when the tracking token is invalid,
// expired, or has been revoked (e.g. after the ride reaches a terminal
// status), then force-disconnects the socket. Surfacing it lets the page stop
// waiting for further updates instead of rendering the last-known status as
// if the ride were still live.
export function onTrackingError(
  callback: (data: { message?: string }) => void,
): () => void {
  socket?.on('tracking:error', callback);
  return () => socket?.off('tracking:error', callback);
}

export function onConnectionState(
  callback: (state: 'connected' | 'disconnected' | 'reconnecting') => void,
): () => void {
  if (!socket) return () => {};
  const handleConnect = () => callback('connected');
  const handleDisconnect = () => callback('disconnected');
  const handleConnectError = () => callback('reconnecting');
  socket.on('connect', handleConnect);
  socket.on('disconnect', handleDisconnect);
  socket.on('connect_error', handleConnectError);
  callback(socket.connected ? 'connected' : 'reconnecting');
  return () => {
    socket?.off('connect', handleConnect);
    socket?.off('disconnect', handleDisconnect);
    socket?.off('connect_error', handleConnectError);
  };
}

export function disconnect(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}