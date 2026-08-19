'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';

const reviewMode = developmentReviewModeEnabled(
  process.env.NODE_ENV,
  process.env.NEXT_PUBLIC_UI_REVIEW_MODE,
);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalUsers: number;
  totalDrivers: number;
  activeRides: number;
  totalRevenuePesewas: number;
  recentRides: RecentRide[];
}

export interface RecentRide {
  id: string;
  passengerName: string;
  driverName: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  status: string;
  farePesewas: number;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminDriver {
  id: string;
  role: string;
  name: string;
  phone: string;
  isOnline: boolean;
  isActive: boolean;
  vehicleRegistration: string | null;
  vehicleColour: string | null;
  subscriptionExpiresAt: string | null;
  rating: string;
  completedRides: number;
  createdAt: string;
}

export interface AdminRide {
  id: string;
  passengerName: string;
  passengerPhone?: string;
  driverName: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  status: string;
  farePesewas: number;
  rideType: string;
  createdAt: string;
}

export interface AdminRideDetail {
  id: string;
  status: string;
  rideType: string;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  estimatedDistanceMeters: number | null;
  estimatedDurationSeconds: number | null;
  estimatedFarePesewas: number;
  actualFarePesewas: number | null;
  cancellationReason: string | null;
  rating: number | null;
  ratingComment: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  passenger: { name: string | null; phoneNumber: string } | null;
  driver: { name: string | null; phoneNumber: string } | null;
  timeline: Array<{ status: string; at: string }>;
}

export interface AdminUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface AdminSubscription {
  id: string;
  driverName: string;
  startDate: string;
  endDate: string;
  status: string;
  amountPesewas: number;
  createdAt: string;
}

const REVIEW_TIMESTAMP = '2026-08-18T12:00:00.000Z';
const REVIEW_RIDES: AdminRide[] = [
  {
    id: 'review-ride-001',
    passengerName: 'Ama Mensah',
    passengerPhone: '+233 20 000 0001',
    driverName: 'Kwame Boateng',
    pickupAddress: 'Market Circle, Takoradi',
    dropoffAddress: 'Airport Roundabout, Takoradi',
    status: 'in_progress',
    farePesewas: 1850,
    rideType: 'standard_tricycle',
    createdAt: REVIEW_TIMESTAMP,
  },
  {
    id: 'review-ride-002',
    passengerName: 'Efua Owusu',
    passengerPhone: '+233 20 000 0002',
    driverName: 'Kojo Ansah',
    pickupAddress: 'Sekondi Station',
    dropoffAddress: 'Harbour Area',
    status: 'completed',
    farePesewas: 2400,
    rideType: 'priority_tricycle',
    createdAt: '2026-08-18T10:30:00.000Z',
  },
];

const REVIEW_DRIVERS: AdminDriver[] = [
  {
    id: 'review-driver-001',
    role: 'driver',
    name: 'Kwame Boateng',
    phone: '+233 24 000 0001',
    isOnline: true,
    isActive: true,
    vehicleRegistration: 'WR 0001-26',
    vehicleColour: 'Green',
    subscriptionExpiresAt: '2026-08-25T12:00:00.000Z',
    rating: '4.8',
    completedRides: 86,
    createdAt: '2026-07-01T08:00:00.000Z',
  },
  {
    id: 'review-driver-002',
    role: 'driver',
    name: 'Kojo Ansah',
    phone: '+233 24 000 0002',
    isOnline: false,
    isActive: true,
    vehicleRegistration: 'WR 0002-26',
    vehicleColour: 'Blue',
    subscriptionExpiresAt: '2026-08-22T12:00:00.000Z',
    rating: '4.6',
    completedRides: 54,
    createdAt: '2026-07-08T08:00:00.000Z',
  },
];

const REVIEW_USERS: AdminUser[] = [
  { id: 'review-user-001', firstName: 'Ama', lastName: 'Mensah', phoneNumber: '+233 20 000 0001', role: 'passenger', status: 'active', createdAt: REVIEW_TIMESTAMP },
  { id: 'review-user-002', firstName: 'Kwame', lastName: 'Boateng', phoneNumber: '+233 24 000 0001', role: 'driver', status: 'active', createdAt: REVIEW_TIMESTAMP },
];

const REVIEW_SUBSCRIPTIONS: AdminSubscription[] = [
  { id: 'review-subscription-001', driverName: 'Kwame Boateng', startDate: '2026-08-18T12:00:00.000Z', endDate: '2026-08-25T12:00:00.000Z', status: 'active', amountPesewas: 5000, createdAt: REVIEW_TIMESTAMP },
  { id: 'review-subscription-002', driverName: 'Kojo Ansah', startDate: '2026-08-15T12:00:00.000Z', endDate: '2026-08-22T12:00:00.000Z', status: 'active', amountPesewas: 5000, createdAt: '2026-08-15T12:00:00.000Z' },
];

function reviewPage<T>(data: T[]): PaginatedResponse<T> {
  return { data, total: data.length, page: 1, totalPages: 1 };
}

function reviewMutationUnavailable(): never {
  throw new Error('Server actions are unavailable in UI review mode.');
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api.get<DashboardStats>('/admin/dashboard'),
    initialData: reviewMode
      ? {
          totalUsers: 248,
          totalDrivers: 42,
          activeRides: 7,
          totalRevenuePesewas: 384_250,
          recentRides: REVIEW_RIDES,
        }
      : undefined,
    enabled: !reviewMode,
    refetchInterval: reviewMode ? false : 15_000,
  });
}

export function useDrivers(page: number = 1, status?: string) {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) params.set('status', status);

  return useQuery<PaginatedResponse<AdminDriver>>({
    queryKey: ['admin', 'drivers', page, status],
    queryFn: () => api.get<PaginatedResponse<AdminDriver>>(`/admin/drivers?${params}`),
    initialData: reviewMode ? reviewPage(REVIEW_DRIVERS) : undefined,
    enabled: !reviewMode,
  });
}

export function useLiveDrivers() {
  return useQuery<PaginatedResponse<AdminDriver>>({
    queryKey: ['admin', 'drivers', 'live'],
    queryFn: () => api.get<PaginatedResponse<AdminDriver>>('/admin/drivers?status=online&limit=100'),
    initialData: reviewMode ? reviewPage(REVIEW_DRIVERS.filter((driver) => driver.isOnline)) : undefined,
    enabled: !reviewMode,
    refetchInterval: reviewMode ? false : 15_000,
  });
}

export function useLiveRides() {
  return useQuery<PaginatedResponse<AdminRide>>({
    queryKey: ['admin', 'rides', 'live'],
    queryFn: () => api.get<PaginatedResponse<AdminRide>>('/admin/rides?status=active&limit=100'),
    initialData: reviewMode ? reviewPage(REVIEW_RIDES.filter((ride) => ride.status !== 'completed')) : undefined,
    enabled: !reviewMode,
    refetchInterval: reviewMode ? false : 15_000,
  });
}

export function useRides(page: number = 1, status?: string, search?: string) {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) params.set('status', status);
  if (search?.trim()) params.set('search', search.trim());

  return useQuery<PaginatedResponse<AdminRide>>({
    queryKey: ['admin', 'rides', page, status, search],
    queryFn: () => api.get<PaginatedResponse<AdminRide>>(`/admin/rides?${params}`),
    initialData: reviewMode ? reviewPage(REVIEW_RIDES) : undefined,
    enabled: !reviewMode,
  });
}

export function useRideDetail(rideId: string | null) {
  return useQuery<AdminRideDetail>({
    queryKey: ['admin', 'ride', rideId],
    queryFn: () => api.get<AdminRideDetail>(`/admin/rides/${rideId}`),
    initialData: reviewMode && rideId
      ? {
          id: rideId,
          status: 'in_progress',
          rideType: 'standard_tricycle',
          pickupAddress: 'Market Circle, Takoradi',
          dropoffAddress: 'Airport Roundabout, Takoradi',
          estimatedDistanceMeters: 6400,
          estimatedDurationSeconds: 900,
          estimatedFarePesewas: 1850,
          actualFarePesewas: null,
          cancellationReason: null,
          rating: null,
          ratingComment: null,
          createdAt: REVIEW_TIMESTAMP,
          updatedAt: REVIEW_TIMESTAMP,
          completedAt: null,
          passenger: { name: 'Ama Mensah', phoneNumber: '+233 20 000 0001' },
          driver: { name: 'Kwame Boateng', phoneNumber: '+233 24 000 0001' },
          timeline: [
            { status: 'requested', at: '2026-08-18T11:55:00.000Z' },
            { status: 'driver_assigned', at: REVIEW_TIMESTAMP },
          ],
        }
      : undefined,
    enabled: Boolean(rideId) && !reviewMode,
  });
}

export function useUsers(page: number = 1) {
  const params = new URLSearchParams({ page: String(page), limit: '20' });

  return useQuery<PaginatedResponse<AdminUser>>({
    queryKey: ['admin', 'users', page],
    queryFn: () => api.get<PaginatedResponse<AdminUser>>(`/admin/users?${params}`),
    initialData: reviewMode ? reviewPage(REVIEW_USERS) : undefined,
    enabled: !reviewMode,
  });
}

export function useSubscriptions(page: number = 1) {
  const params = new URLSearchParams({ page: String(page), limit: '20' });

  return useQuery<PaginatedResponse<AdminSubscription>>({
    queryKey: ['admin', 'subscriptions', page],
    queryFn: () => api.get<PaginatedResponse<AdminSubscription>>(`/admin/subscriptions?${params}`),
    initialData: reviewMode ? reviewPage(REVIEW_SUBSCRIPTIONS) : undefined,
    enabled: !reviewMode,
  });
}

export function useDriverDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ driverId, decision, reason }: { driverId: string; decision: 'approve' | 'reject'; reason?: string }) => {
      if (reviewMode) reviewMutationUnavailable();
      return decision === 'approve'
          ? api.post(`/admin/drivers/${driverId}/approve`)
          : api.post(`/admin/drivers/${driverId}/reject`, { reason });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
    },
  });
}

export function useUserStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'active' | 'suspended' }) => {
      if (reviewMode) reviewMutationUnavailable();
      return api.patch(`/admin/users/${userId}/status`, { status });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useAdminRideCancellation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rideId, reason }: { rideId: string; reason: string }) => {
      if (reviewMode) reviewMutationUnavailable();
      return api.patch(`/admin/rides/${rideId}/cancel`, { reason });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'rides'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}
