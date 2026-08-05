'use client';

import Link from 'next/link';
import { useLiveDrivers, useLiveRides } from '@/lib/hooks';

function point(index: number) {
  return { left: `${20 + ((index * 37) % 70)}%`, top: `${20 + ((index * 53) % 60)}%` };
}

export default function LiveMapPage() {
  const drivers = useLiveDrivers();
  const rides = useLiveRides();
  const error = drivers.error || rides.error;
  const loading = drivers.isLoading || rides.isLoading;
  return (
    <div>
      <div className="mb-6 flex items-center justify-between"><h2 className="text-2xl font-bold text-gray-900">Live operations</h2><span className="text-xs text-gray-500">Refreshes every 15 seconds</span></div>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Live operations data unavailable: {(error as Error).message}</div>}
      {loading ? <div className="flex h-96 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500">Loading live operations…</div> : <>
        <div className="relative h-96 overflow-hidden rounded-xl border border-gray-200 bg-slate-100" aria-label="Live operations map">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-blue-50" />
          {drivers.data?.data.map((driver, index) => <div key={driver.id} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={point(index)}><div className="h-4 w-4 rounded-full border-2 border-white bg-green-600 shadow" /><span className="mt-1 block rounded bg-white/90 px-1 text-[10px] text-gray-700">{driver.name}</span></div>)}
          {rides.data?.data.map((ride, index) => <Link key={ride.id} href={`/dashboard/rides?search=${ride.id}`} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={point(index + (drivers.data?.data.length || 0))}><div className="h-3 w-3 rounded-full border-2 border-white bg-amber-500 shadow" /><span className="mt-1 block rounded bg-white/90 px-1 text-[10px] text-gray-700">{ride.status.replace(/_/g, ' ')}</span></Link>)}
          {!drivers.data?.data.length && !rides.data?.data.length && <div className="absolute inset-0 flex items-center justify-center text-gray-500">No online drivers or active rides.</div>}
          <div className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-[10px] text-gray-500">Development operational projection · no private passenger data</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4"><div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-sm text-gray-500">Online drivers</p><p className="text-2xl font-bold">{drivers.data?.total ?? 0}</p></div><div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-sm text-gray-500">Active rides</p><p className="text-2xl font-bold">{rides.data?.total ?? 0}</p></div></div>
      </>}
    </div>
  );
}
