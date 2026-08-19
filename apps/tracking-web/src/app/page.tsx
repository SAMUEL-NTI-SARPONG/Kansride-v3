'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';

const reviewMode = developmentReviewModeEnabled(
  process.env.NODE_ENV,
  process.env.NEXT_PUBLIC_UI_REVIEW_MODE,
);

export default function TrackingHome() {
  const [trackingToken, setTrackingToken] = useState('');
  const router = useRouter();

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = trackingToken.trim();
    const tokenFromLink = trimmed.split('/track/').pop()?.split(/[?#]/)[0] ?? '';
    if (tokenFromLink) {
      router.push(`/track/${encodeURIComponent(tokenFromLink)}`);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F6F0E6] px-5 py-10">
      <div className="absolute -left-28 top-12 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-24 bottom-8 h-64 w-64 rounded-full bg-secondary/15 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-base font-black text-white shadow-control">KR</div>
          <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-primary-dark">Track a KansRide</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#61736F]">Follow the driver and ride status from a secure link shared by the passenger.</p>
        </div>

        <form onSubmit={handleTrack} className="space-y-5 rounded-3xl border border-[#DDD4C4] bg-[#FFFDF8] p-6 shadow-panel sm:p-7">
          <div>
            <label htmlFor="trackingToken" className="mb-2 block text-sm font-bold text-[#284844]">
              Tracking link
            </label>
            <input
              id="trackingToken"
              type="text"
              value={trackingToken}
              onChange={(e) => setTrackingToken(e.target.value)}
              placeholder="Paste the tracking link or token"
              className="w-full rounded-xl border border-[#D8CFBF] bg-white px-4 py-3.5 text-sm text-[#173633] outline-none transition placeholder:text-[#87948F] focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="submit"
            disabled={!trackingToken.trim()}
            className="w-full rounded-xl bg-primary py-3.5 font-bold text-white shadow-control transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-[#789C97] disabled:text-white/90 disabled:shadow-none"
          >
            Track ride
          </button>
        </form>

        {reviewMode && (
          <Link
            href="/track/ui-review"
            className="mt-4 block rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-950 transition hover:bg-amber-100"
          >
            Open UI review ride
          </Link>
        )}

        <p className="mt-6 text-center text-xs leading-5 text-[#6A7B76]">
          Your link reveals only the trip details needed for safety tracking.
        </p>
      </div>
    </div>
  );
}
