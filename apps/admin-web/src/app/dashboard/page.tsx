'use client';

import { useDashboardStats } from '@/lib/hooks';
import { formatGhsFromPesewas } from '@/lib/currency';
import { formatDateTime } from '@/lib/datetime';

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 h-28" />
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
    { label: 'Total Users', value: data?.totalUsers ?? 0 },
    { label: 'Total Drivers', value: data?.totalDrivers ?? 0 },
    { label: 'Active Rides', value: data?.activeRides ?? 0 },
    { label: 'Revenue', value: formatGhsFromPesewas(data?.totalRevenuePesewas) },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Rides */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Rides</h3>
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
