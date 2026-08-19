'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { clearAdminSession, getAdminRole, hasAdminSession } from '@/lib/api';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';

const reviewMode = developmentReviewModeEnabled(
  process.env.NODE_ENV,
  process.env.NEXT_PUBLIC_UI_REVIEW_MODE,
);

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: 'grid' },
  { href: '/dashboard/drivers', label: 'Drivers', icon: 'car' },
  { href: '/dashboard/rides', label: 'Rides', icon: 'route' },
  { href: '/dashboard/subscriptions', label: 'Subscriptions', icon: 'card' },
  { href: '/dashboard/live-map', label: 'Live Map', icon: 'map' },
  { href: '/dashboard/users', label: 'Users', icon: 'users' },
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
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reviewMode) {
      setReady(true);
      return;
    }
    if (!hasAdminSession()) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F0E6] text-[#61736F]">
        <div className="flex items-center gap-3 rounded-2xl border border-[#DDD4C4] bg-[#FFFDF8] px-5 py-4 shadow-panel">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
          Checking session…
        </div>
      </div>
    );
  }

  const role = reviewMode ? 'super_admin' : getAdminRole();
  const allowed = role ? ROLE_NAV[role] : undefined;
  const visibleNav = allowed ? navItems.filter((item) => allowed.has(item.label)) : navItems;

  return (
    <div className="min-h-screen lg:flex">
      <aside className="admin-sidebar border-b px-4 py-4 lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:w-64 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <div className="flex items-center justify-between lg:block">
          <div className="flex items-center gap-3 lg:mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-black text-white shadow-control">KR</div>
            <div>
              <h1 className="text-xl font-extrabold tracking-[-0.03em] text-primary-dark">KansRide</h1>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A8883]">Operations</p>
            </div>
          </div>
          <div className="rounded-full border border-[#CADFD9] bg-[#E7F2EF] px-3 py-1 text-[11px] font-bold text-primary lg:hidden">Admin</div>
        </div>
        <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 lg:mt-0 lg:block lg:space-y-1 lg:overflow-visible" aria-label="Admin navigation">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-link shrink-0 ${
                pathname === item.href ? 'admin-nav-link-active' : ''
              }`}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        {!reviewMode && (
          <button
            type="button"
            onClick={() => {
              clearAdminSession();
              router.replace('/login');
            }}
            className="mt-8 hidden w-full rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 lg:block"
          >
            Sign out
          </button>
        )}
      </aside>
      <main className="admin-main min-w-0 px-4 py-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-8 xl:px-12">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Control centre</p>
            <p className="mt-1 text-sm text-[#61736F]">Monitor service health and daily operations.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-[#DDD4C4] bg-[#FFFDF8] px-3 py-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-[#526963]">Operations online</span>
          </div>
        </header>
        {reviewMode && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            <span><strong>Read-only preview.</strong> Authentication is bypassed locally; live data and server actions remain unavailable.</span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    car: <><path d="M5 17h14l-1.2-6.2A2 2 0 0 0 15.8 9H8.2a2 2 0 0 0-2 1.8L5 17Z"/><path d="M7 9l1.2-3h7.6L17 9M6 17v2m12-2v2"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/></>,
    route: <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></>,
    map: <><path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2V6Z"/><path d="M8 4v13m8-10v13"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
