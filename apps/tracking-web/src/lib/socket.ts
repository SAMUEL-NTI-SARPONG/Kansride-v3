import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const NAMESPACE = '/rides';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(`${SOCKET_URL}${NAMESPACE}`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socket;
}

export function subscribeToRide(rideId: string): void {
  const s = getSocket();
  s.emit('ride:subscribe', { rideId });
}

export function onLocationUpdate(
  callback: (data: {
    rideId: string;
    driverId: string;
    latitude: number;
    longitude: number;
    timestamp: number;
  }) => void,
): void {
  const s = getSocket();
  s.on('ride:driver-location', callback);
}

export function onRideUpdate(
  callback: (data: { rideId: string; status: string; [key: string]: unknown }) => void,
): void {
  const s = getSocket();
  s.on('ride:update', callback);
}

export function disconnect(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
