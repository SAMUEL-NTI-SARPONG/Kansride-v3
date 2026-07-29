'use client';

import { useState } from 'react';
import { useDrivers } from '@/lib/hooks';

export default function DriversPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { data, isLoading, error } = useDrivers(page, statusFilter);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Driver Management</h2>
        <div className="flex gap-2">
          {['all', 'online', 'offline'].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s === 'all' ? undefined : s);
                // Reset to the first page when the filter changes, mirroring
                // the Rides page: otherwise page=N persists and the new
                // filtered result set may have fewer pages, leaving the user
                // on an empty intersection with a stale pager.
                setPage(1);
              }}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
                (s === 'all' && !statusFilter) || statusFilter === s
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-4">
          Failed to load drivers: {(error as Error).message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscription</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-full" /></td>
                </tr>
              ))
            ) : data?.data && data.data.length > 0 ? (
              data.data.map((driver) => (
                <tr key={driver.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{driver.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{driver.phone}</td>
                  <td className="px-6 py-4">
                    <DriverStatusBadge isOnline={driver.isOnline} isActive={driver.isActive} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {driver.vehicleRegistration ? `${driver.vehicleRegistration} (${driver.vehicleColour || ''})` : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <SubscriptionBadge expiresAt={driver.subscriptionExpiresAt} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{driver.rating}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">No drivers registered yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-gray-500">
            Page {data.page} of {data.totalPages} ({data.total} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DriverStatusBadge({ isOnline, isActive }: { isOnline: boolean; isActive: boolean }) {
  if (!isActive) {
    return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Suspended</span>;
  }
  if (isOnline) {
    return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Online</span>;
  }
  return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Offline</span>;
}

function SubscriptionBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) {
    return <span className="text-xs text-gray-400">None</span>;
  }
  const isActive = new Date(expiresAt) > new Date();
  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
      {isActive ? 'Active' : 'Expired'}
    </span>
  );
}
