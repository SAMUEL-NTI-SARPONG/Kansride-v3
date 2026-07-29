'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAdminSession, getAdminRole, hasAdminSession } from '@/lib/api';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '📊' },
  { href: '/dashboard/drivers', label: 'Drivers', icon: '🚗' },
  { href: '/dashboard/rides', label: 'Rides', icon: '🛣️' },
  { href: '/dashboard/subscriptions', label: 'Subscriptions', icon: '💳' },
  { href: '/dashboard/live-map', label: 'Live Map', icon: '🗺️' },
  { href: '/dashboard/users', label: 'Users', icon: '👥' },
];

// Per-role nav visibility, aligned with the backend admin controller's
// @RequirePermissions mapping (see admin.controller.ts):
//   Overview      GET /admin/dashboard      -> admin:view_analytics
//   Drivers       GET /admin/drivers        -> admin:manage_drivers
//   Rides         GET /admin/rides          -> ride:view_all
//   Subscriptions GET /admin/subscriptions  -> admin:manage_subscriptions
//   Users         GET /admin/users          -> admin:manage_users
// Live Map is gated by dispatch:view_live_map (no backend page yet). The
// logged-in role admitted by the login gate is one of: super_admin,
// system_admin, ops_admin, finance_officer, auditor. Roles not listed fall
// back to showing all nav items (the prior behaviour) so a decode edge case
// never locks a valid session out of the nav; the backend remains the
// authoritative authorizer either way.
const ROLE_NAV: Record<string, Set<string>> = {
  super_admin: new Set(navItems.map((n) => n.label)),
  system_admin: new Set(navItems.map((n) => n.label)),
  ops_admin: new Set(navItems.map((n) => n.label)),
  finance_officer: new Set(['Overview', 'Subscriptions']),
  auditor: new Set(['Overview', 'Rides']),
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasAdminSession()) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Checking session…
      </div>
    );
  }

  const role = getAdminRole();
  const allowed = role ? ROLE_NAV[role] : undefined;
  const visibleNav = allowed ? navItems.filter((item) => allowed.has(item.label)) : navItems;

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-r border-gray-200 p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary">KansRide</h1>
          <p className="text-xs text-gray-500 mt-1">Admin Panel</p>
        </div>
        <nav className="space-y-1">
          {visibleNav.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-primary transition">
              <span>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => {
            clearAdminSession();
            router.replace('/login');
          }}
          className="mt-8 w-full px-4 py-2 text-sm text-red-700 bg-red-50 rounded-lg"
        >
          Sign out
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
