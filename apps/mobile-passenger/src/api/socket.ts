import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './client';
import { mobileRuntimeUrl } from '@kansride/config';
import type { RideUpdatePayload } from '@kansride/types';

import {
  SUBSCRIPTION_ACK_TIMEOUT_MS,
  subscriptionError,
  type SubscriptionResponse,
} from './subscription-protocol';

const SOCKET_URL = mobileRuntimeUrl(
  'EXPO_PUBLIC_WS_URL',
  process.env.EXPO_PUBLIC_WS_URL,
  'http://localhost:3000',
);

let socket: Socket | null = null;
const subscribedRideIds = new Set<string>();

export interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

export interface RideUpdate extends RideUpdatePayload {
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
      for (const rideId of subscribedRideIds) {
        emitSubscription(rideId).catch(() => undefined);
      }
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

export async function subscribeToRide(rideId: string): Promise<void> {
  subscribedRideIds.add(rideId);
  try {
    await emitSubscription(rideId);
  } catch (error) {
    subscribedRideIds.delete(rideId);
    throw error;
  }
}

function emitSubscription(rideId: string): Promise<void> {
  const activeSocket = socket;
  if (!activeSocket?.connected) {
    return Promise.reject(new Error('Socket is not connected'));
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Ride subscription timed out'));
    }, SUBSCRIPTION_ACK_TIMEOUT_MS);
    activeSocket.emit('ride:subscribe', { rideId }, (response: SubscriptionResponse) => {
      clearTimeout(timeout);
      const error = subscriptionError(rideId, response);
      if (!error) {
        resolve();
        return;
      }
      reject(error);
    });
  });
}


export function unsubscribeFromRide(rideId: string): void {
  subscribedRideIds.delete(rideId);
  if (!socket?.connected) return;
  socket.emit('ride:unsubscribe', { rideId });
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
