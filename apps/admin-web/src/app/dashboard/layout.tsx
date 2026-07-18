import Link from 'next/link';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '📊' },
  { href: '/dashboard/drivers', label: 'Drivers', icon: '🚗' },
  { href: '/dashboard/rides', label: 'Rides', icon: '🛣️' },
  { href: '/dashboard/subscriptions', label: 'Subscriptions', icon: '💳' },
  { href: '/dashboard/live-map', label: 'Live Map', icon: '🗺️' },
  { href: '/dashboard/users', label: 'Users', icon: '👥' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-r border-gray-200 p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary">KansRide</h1>
          <p className="text-xs text-gray-500 mt-1">Admin Panel</p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-primary transition">
              <span>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
