const stats = [
  { label: 'Active Drivers', value: '0', change: '+0 today' },
  { label: 'Total Rides', value: '0', change: '+0 today' },
  { label: 'Revenue (GHS)', value: '0.00', change: '+0 today' },
  { label: 'Active Subscriptions', value: '0', change: '0 expiring' },
];

export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-2">{stat.change}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
