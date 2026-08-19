'use client';

import { useDashboardStats } from '@/lib/hooks';
import { formatGhsFromPesewas } from '@/lib/currency';
import { formatDateTime } from '@/lib/datetime';

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <h2 className="mb-6 text-3xl font-extrabold text-gray-900">Dashboard overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-gray-200 bg-white p-6" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        <p className="font-medium">Failed to load dashboard</p>
        <p className="text-sm mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  const stats = [
    { label: 'Total users', value: data?.totalUsers ?? 0, detail: 'Registered accounts' },
    { label: 'Total drivers', value: data?.totalDrivers ?? 0, detail: 'Approved and applicants' },
    { label: 'Active rides', value: data?.activeRides ?? 0, detail: 'Currently in service' },
    { label: 'Revenue', value: formatGhsFromPesewas(data?.totalRevenuePesewas), detail: 'Completed ride value' },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900">Dashboard overview</h2>
          <p className="mt-1 text-sm text-gray-500">A focused view of KansRide operations today.</p>
        </div>
        <span className="rounded-full border border-[#CADFD9] bg-[#E7F2EF] px-3 py-1.5 text-xs font-bold text-primary">Live overview</span>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 h-1 w-9 rounded-full bg-primary/70" />
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500">{stat.label}</p>
            <p className="mt-1 text-3xl font-extrabold tracking-[-0.035em] text-gray-900">{stat.value}</p>
            <p className="mt-2 text-xs text-gray-500">{stat.detail}</p>
          </div>
        ))}
      </div>

      {/* Recent Rides */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Recent rides</h3>
        </div>
        {data?.recentRides && data.recentRides.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pickup</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fare</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.recentRides.map((ride) => (
                <tr key={ride.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.passengerName}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ride.driverName || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-[150px] truncate">{ride.pickupAddress || '—'}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={ride.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatGhsFromPesewas(ride.farePesewas)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDateTime(ride.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-12 text-center text-gray-400">No rides recorded yet</div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    in_progress: 'bg-blue-100 text-blue-700',
    requested: 'bg-yellow-100 text-yellow-700',
    cancelled_by_passenger: 'bg-red-100 text-red-700',
    cancelled_by_driver: 'bg-red-100 text-red-700',
    cancelled_by_admin: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
