'use client';

import { useQuery } from '@tanstack/react-query';
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
  driverName: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  status: string;
  farePesewas: number;
  rideType: string;
  createdAt: string;
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

export function useRides(page: number = 1, status?: string) {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) params.set('status', status);

  return useQuery<PaginatedResponse<AdminRide>>({
    queryKey: ['admin', 'rides', page, status],
    queryFn: () => api.get<PaginatedResponse<AdminRide>>(`/admin/rides?${params}`),
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
