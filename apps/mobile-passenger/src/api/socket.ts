import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './client';

const SOCKET_URL = process.env.EXPO_PUBLIC_WS_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

export interface RideUpdate {
  rideId: string;
  status: string;
  driver?: {
    id: string;
    name: string;
    phone: string;
    vehicle: string;
    plateNumber: string;
    rating: number;
  };
  estimatedArrival?: number;
}

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await getAccessToken();
  if (!token) throw new Error('No auth token for socket connection');

  socket = io(`${SOCKET_URL}/rides`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to rides namespace');
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.log('[Socket] Connection error:', err.message);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function subscribeToRide(rideId: string): void {
  if (!socket?.connected) {
    console.warn('[Socket] Not connected, cannot subscribe to ride:', rideId);
    return;
  }
  socket.emit('ride:subscribe', { rideId });
  console.log('[Socket] Subscribed to ride:', rideId);
}

export function unsubscribeFromRide(rideId: string): void {
  if (!socket?.connected) return;
  socket.emit('ride:unsubscribe', { rideId });
  console.log('[Socket] Unsubscribed from ride:', rideId);
}

export function onRideUpdate(callback: (data: RideUpdate) => void): () => void {
  if (!socket) return () => {};
  socket.on('ride:update', callback);
  return () => {
    socket?.off('ride:update', callback);
  };
}

export function onDriverAssigned(
  callback: (data: RideUpdate) => void,
): () => void {
  if (!socket) return () => {};
  socket.on('ride:driver-assigned', callback);
  return () => {
    socket?.off('ride:driver-assigned', callback);
  };
}

export function onDriverLocation(
  callback: (data: DriverLocation) => void,
): () => void {
  if (!socket) return () => {};
  socket.on('ride:driver-location', callback);
  return () => {
    socket?.off('ride:driver-location', callback);
  };
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
