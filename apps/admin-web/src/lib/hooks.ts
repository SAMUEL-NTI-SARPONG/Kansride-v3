'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

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

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api.get<DashboardStats>('/admin/dashboard'),
    refetchInterval: 15_000,
  });
}

export function useDrivers(page: number = 1, status?: string) {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) params.set('status', status);

  return useQuery<PaginatedResponse<AdminDriver>>({
    queryKey: ['admin', 'drivers', page, status],
    queryFn: () => api.get<PaginatedResponse<AdminDriver>>(`/admin/drivers?${params}`),
  });
}

export function useLiveDrivers() {
  return useQuery<PaginatedResponse<AdminDriver>>({
    queryKey: ['admin', 'drivers', 'live'],
    queryFn: () => api.get<PaginatedResponse<AdminDriver>>('/admin/drivers?status=online&limit=100'),
    refetchInterval: 15_000,
  });
}

export function useLiveRides() {
  return useQuery<PaginatedResponse<AdminRide>>({
    queryKey: ['admin', 'rides', 'live'],
    queryFn: () => api.get<PaginatedResponse<AdminRide>>('/admin/rides?status=active&limit=100'),
    refetchInterval: 15_000,
  });
}

export function useRides(page: number = 1, status?: string, search?: string) {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) params.set('status', status);
  if (search?.trim()) params.set('search', search.trim());

  return useQuery<PaginatedResponse<AdminRide>>({
    queryKey: ['admin', 'rides', page, status, search],
    queryFn: () => api.get<PaginatedResponse<AdminRide>>(`/admin/rides?${params}`),
  });
}

export function useRideDetail(rideId: string | null) {
  return useQuery<AdminRideDetail>({
    queryKey: ['admin', 'ride', rideId],
    queryFn: () => api.get<AdminRideDetail>(`/admin/rides/${rideId}`),
    enabled: Boolean(rideId),
  });
}

export function useUsers(page: number = 1) {
  const params = new URLSearchParams({ page: String(page), limit: '20' });

  return useQuery<PaginatedResponse<AdminUser>>({
    queryKey: ['admin', 'users', page],
    queryFn: () => api.get<PaginatedResponse<AdminUser>>(`/admin/users?${params}`),
  });
}

export function useSubscriptions(page: number = 1) {
  const params = new URLSearchParams({ page: String(page), limit: '20' });

  return useQuery<PaginatedResponse<AdminSubscription>>({
    queryKey: ['admin', 'subscriptions', page],
    queryFn: () => api.get<PaginatedResponse<AdminSubscription>>(`/admin/subscriptions?${params}`),
  });
}

export function useDriverDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ driverId, decision, reason }: { driverId: string; decision: 'approve' | 'reject'; reason?: string }) =>
      decision === 'approve'
        ? api.post(`/admin/drivers/${driverId}/approve`)
        : api.post(`/admin/drivers/${driverId}/reject`, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
    },
  });
}

export function useUserStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'active' | 'suspended' }) =>
      api.patch(`/admin/users/${userId}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useAdminRideCancellation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rideId, reason }: { rideId: string; reason: string }) =>
      api.patch(`/admin/rides/${rideId}/cancel`, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'rides'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}
