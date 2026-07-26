import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './client';
import type { RideUpdatePayload } from '@kansride/types';

const SOCKET_URL = process.env.EXPO_PUBLIC_WS_URL || 'http://localhost:3000';

let socket: Socket | null = null;
const subscribedRideIds = new Set<string>();

export interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

export interface RideUpdate extends RideUpdatePayload {
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

  if (!socket) {
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
      for (const rideId of subscribedRideIds) {
        socket?.emit('ride:subscribe', { rideId });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });
  } else {
    socket.auth = { token };
    socket.connect();
  }

  await waitForConnection(socket);
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function subscribeToRide(rideId: string): void {
  subscribedRideIds.add(rideId);
  if (!socket?.connected) {
    return;
  }
  socket.emit('ride:subscribe', { rideId });
  console.log('[Socket] Subscribed to ride:', rideId);
}

export function unsubscribeFromRide(rideId: string): void {
  subscribedRideIds.delete(rideId);
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
  subscribedRideIds.clear();
}

function waitForConnection(target: Socket): Promise<void> {
  if (target.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      target.off('connect', handleConnect);
      target.off('connect_error', handleError);
      reject(new Error('Socket connection timed out'));
    }, 10_000);
    const handleConnect = () => {
      clearTimeout(timeout);
      target.off('connect_error', handleError);
      resolve();
    };
    const handleError = (error: Error) => {
      clearTimeout(timeout);
      target.off('connect', handleConnect);
      reject(error);
    };
    target.once('connect', handleConnect);
    target.once('connect_error', handleError);
  });
}
