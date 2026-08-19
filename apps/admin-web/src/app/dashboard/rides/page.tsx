'use client';

import { useState } from 'react';
import { useRides, useRideDetail, useAdminRideCancellation } from '@/lib/hooks';
import { formatGhsFromPesewas } from '@/lib/currency';
import { formatDateTime } from '@/lib/datetime';

const STATUS_TABS = [
  { key: undefined, label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

export default function RidesPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const { data, isLoading, error } = useRides(page, statusFilter, search);
  const { data: rideDetail, isLoading: detailLoading, error: detailError } = useRideDetail(selectedRideId);
  const cancellation = useAdminRideCancellation();

  const cancelRide = async (rideId: string) => {
    const reason = window.prompt('Cancellation reason')?.trim();
    if (!reason) return;
    try {
      await cancellation.mutateAsync({ rideId, reason });
    } catch (mutationError) {
      window.alert(mutationError instanceof Error ? mutationError.message : 'Ride cancellation failed');
    }
  };

  return (
    <div>
      <div className="mb-6"><h2 className="text-3xl font-extrabold text-gray-900">Ride history</h2><p className="mt-1 text-sm text-gray-500">Search and investigate every ride state.</p></div>

      <input
        value={search}
        onChange={(event) => { setSearch(event.target.value); setPage(1); }}
        placeholder="Search ride UUID or passenger phone"
        className="mb-4 w-full max-w-md rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm"
        aria-label="Search rides"
      />

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

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={9} className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-full" /></td>
                </tr>
              ))
            ) : data?.data && data.data.length > 0 ? (
              data.data.map((ride) => (
                <tr key={ride.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedRideId(ride.id)}>
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
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDateTime(ride.createdAt)}</td>
                  <td className="px-6 py-4">
                    {['requested', 'searching', 'driver_offered', 'driver_assigned', 'driver_en_route', 'driver_arrived', 'waiting_for_passenger', 'passenger_verified', 'in_progress'].includes(ride.status) && (
                      <button type="button" onClick={() => void cancelRide(ride.id)} disabled={cancellation.isPending} className="text-xs font-semibold text-red-700">
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-400">No rides recorded yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedRideId && (
        <div className="fixed inset-0 z-20 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="Ride investigation">
          <aside className="h-full w-full max-w-lg overflow-y-auto border-l border-[#DDD4C4] bg-[#FFFDF8] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Ride investigation</h3>
              <button type="button" onClick={() => setSelectedRideId(null)} className="text-sm text-gray-500">Close</button>
            </div>
            {detailLoading && <p className="text-sm text-gray-500">Loading ride details…</p>}
            {detailError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Failed to load details: {(detailError as Error).message}</p>}
            {rideDetail && (
              <div className="space-y-5 text-sm">
                <div><p className="text-xs uppercase text-gray-400">Status</p><p className="font-semibold capitalize">{rideDetail.status.replace(/_/g, ' ')}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs uppercase text-gray-400">Passenger</p><p>{rideDetail.passenger?.name || 'Unknown'}</p><p className="text-gray-500">{rideDetail.passenger?.phoneNumber || '—'}</p></div>
                  <div><p className="text-xs uppercase text-gray-400">Driver</p><p>{rideDetail.driver?.name || 'Unassigned'}</p><p className="text-gray-500">{rideDetail.driver?.phoneNumber || '—'}</p></div>
                </div>
                <div><p className="text-xs uppercase text-gray-400">Route</p><p>{rideDetail.pickupAddress || 'Pickup location'} → {rideDetail.dropoffAddress || 'Dropoff location'}</p></div>
                <div><p className="text-xs uppercase text-gray-400">Fare</p><p>{formatGhsFromPesewas(rideDetail.actualFarePesewas ?? rideDetail.estimatedFarePesewas)}</p></div>
                {rideDetail.cancellationReason && <div><p className="text-xs uppercase text-gray-400">Cancellation reason</p><p>{rideDetail.cancellationReason}</p></div>}
                {rideDetail.rating && <div><p className="text-xs uppercase text-gray-400">Rating</p><p>{rideDetail.rating}/5 {rideDetail.ratingComment ? `— ${rideDetail.ratingComment}` : ''}</p></div>}
                <div><p className="mb-2 text-xs uppercase text-gray-400">Persisted timeline</p><ol className="space-y-2 border-l border-gray-200 pl-4">{rideDetail.timeline.map((event) => <li key={`${event.status}-${event.at}`}><p className="font-medium capitalize">{event.status.replace(/_/g, ' ')}</p><p className="text-gray-500">{formatDateTime(event.at)}</p></li>)}</ol></div>
              </div>
            )}
          </aside>
        </div>
      )}

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
