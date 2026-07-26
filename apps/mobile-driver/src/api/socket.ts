import { io, Socket } from 'socket.io-client';
import { getStoredToken } from './client';
import type { RideUpdatePayload } from '@kansride/types';

const SOCKET_URL = process.env.EXPO_PUBLIC_WS_URL || 'http://localhost:3000';

let socket: Socket | null = null;
let locationInterval: ReturnType<typeof setInterval> | null = null;

export interface RideOffer {
  rideId: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  estimatedFarePesewas: number;
  distance: number;
}

export type RideUpdateData = RideUpdatePayload;

export async function connect(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await getStoredToken();
  if (!token) throw new Error('No auth token available');

  socket = io(`${SOCKET_URL}/rides`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 3000,
    reconnectionDelayMax: 10000,
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnect(): void {
  stopLocationEmission();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function sendLocation(latitude: number, longitude: number): void {
  if (socket?.connected) {
    socket.emit('driver:location', { latitude, longitude });
  }
}

export function startLocationEmission(getLocation: () => { latitude: number; longitude: number }): void {
  stopLocationEmission();
  // Send immediately
  const loc = getLocation();
  sendLocation(loc.latitude, loc.longitude);

  // Then every 10 seconds
  locationInterval = setInterval(() => {
    const currentLoc = getLocation();
    sendLocation(currentLoc.latitude, currentLoc.longitude);
  }, 10000);
}

export function stopLocationEmission(): void {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
}

export function acceptRide(rideId: string): void {
  if (socket?.connected) {
    socket.emit('driver:accept-ride', { rideId });
  }
}

export function declineRide(rideId: string): void {
  if (socket?.connected) {
    socket.emit('driver:decline-ride', { rideId });
  }
}

export function subscribeToRide(rideId: string): void {
  if (socket?.connected) {
    socket.emit('ride:subscribe', { rideId });
  }
}

export function onRideOffered(callback: (data: RideOffer) => void): () => void {
  if (!socket) return () => {};
  socket.on('ride:offered', callback);
  return () => { socket?.off('ride:offered', callback); };
}

export function onRideUpdate(callback: (data: RideUpdateData) => void): () => void {
  if (!socket) return () => {};
  socket.on('ride:update', callback);
  return () => { socket?.off('ride:update', callback); };
}

export function onRideCancelled(callback: (data: { rideId: string; reason?: string }) => void): () => void {
  if (!socket) return () => {};
  socket.on('ride:cancelled', callback);
  return () => { socket?.off('ride:cancelled', callback); };
}

export function onError(callback: (data: { message: string }) => void): () => void {
  if (!socket) return () => {};
  socket.on('error', callback);
  return () => { socket?.off('error', callback); };
}
