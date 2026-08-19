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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-3xl font-extrabold text-gray-900">Live operations</h2><p className="mt-1 text-sm text-gray-500">Driver availability and active jobs at a glance.</p></div><span className="rounded-full border border-[#CADFD9] bg-[#E7F2EF] px-3 py-1.5 text-xs font-bold text-primary">Refreshes every 15 seconds</span></div>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Live operations data unavailable: {(error as Error).message}</div>}
      {loading ? <div className="flex h-96 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500">Loading live operations…</div> : <>
        <div className="relative h-[30rem] overflow-hidden rounded-xl border border-gray-200 bg-[#E2EAE5]" aria-label="Live operations map">
          <div className="absolute inset-0 bg-[linear-gradient(35deg,rgba(7,94,89,0.08)_25%,transparent_25%),linear-gradient(145deg,rgba(255,253,248,0.72)_35%,transparent_35%),linear-gradient(90deg,rgba(230,168,75,0.09)_1px,transparent_1px),linear-gradient(rgba(7,94,89,0.06)_1px,transparent_1px)] bg-[length:220px_220px,260px_260px,48px_48px,48px_48px]" />
          {drivers.data?.data.map((driver, index) => <div key={driver.id} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={point(index)}><div className="h-4 w-4 rounded-full border-2 border-white bg-green-600 shadow" /><span className="mt-1 block rounded bg-white/90 px-1 text-[10px] text-gray-700">{driver.name}</span></div>)}
          {rides.data?.data.map((ride, index) => <Link key={ride.id} href={`/dashboard/rides?search=${ride.id}`} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={point(index + (drivers.data?.data.length || 0))}><div className="h-3 w-3 rounded-full border-2 border-white bg-amber-500 shadow" /><span className="mt-1 block rounded bg-white/90 px-1 text-[10px] text-gray-700">{ride.status.replace(/_/g, ' ')}</span></Link>)}
          {!drivers.data?.data.length && !rides.data?.data.length && <div className="absolute inset-0 flex items-center justify-center text-gray-500">No online drivers or active rides.</div>}
          <div className="absolute bottom-3 left-3 rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-[10px] font-medium text-gray-500 shadow-sm">Development operational projection · no private passenger data</div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500">Online drivers</p><p className="mt-1 text-3xl font-extrabold text-gray-900">{drivers.data?.total ?? 0}</p></div><div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500">Active rides</p><p className="mt-1 text-3xl font-extrabold text-gray-900">{rides.data?.total ?? 0}</p></div></div>
      </>}
    </div>
  );
}
