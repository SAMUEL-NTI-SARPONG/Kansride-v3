'use client';

import { useState } from 'react';
import { useRides } from '@/lib/hooks';
import { formatGhsFromPesewas } from '@/lib/currency';

const STATUS_TABS = [
  { key: undefined, label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

export default function RidesPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { data, isLoading, error } = useRides(page, statusFilter);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Ride History</h2>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => { setStatusFilter(tab.key); setPage(1); }}
            className={`px-4 py-2 text-sm rounded-md font-medium transition ${
              statusFilter === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-4">
          Failed to load rides: {(error as Error).message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pickup</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dropoff</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fare</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={8} className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-full" /></td>
                </tr>
              ))
            ) : data?.data && data.data.length > 0 ? (
              data.data.map((ride) => (
                <tr key={ride.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{ride.id.slice(0, 8)}...</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.passengerName}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.driverName || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-[120px] truncate">{ride.pickupAddress || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-[120px] truncate">{ride.dropoffAddress || '—'}</td>
                  <td className="px-6 py-4">
                    <RideStatusBadge status={ride.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatGhsFromPesewas(ride.farePesewas)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(ride.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-400">No rides recorded yet</td>
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

function RideStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    in_progress: 'bg-blue-100 text-blue-700',
    driver_en_route: 'bg-blue-100 text-blue-700',
    driver_arrived: 'bg-blue-100 text-blue-700',
    requested: 'bg-yellow-100 text-yellow-700',
    searching: 'bg-yellow-100 text-yellow-700',
    cancelled_by_passenger: 'bg-red-100 text-red-700',
    cancelled_by_driver: 'bg-red-100 text-red-700',
    cancelled_by_admin: 'bg-red-100 text-red-700',
    no_driver_found: 'bg-orange-100 text-orange-700',
  };

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
