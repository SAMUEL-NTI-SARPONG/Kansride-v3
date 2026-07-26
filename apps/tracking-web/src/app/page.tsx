'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-blue-50">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <span className="text-5xl block mb-4">🛺</span>
          <h1 className="text-3xl font-bold text-green-700">KansRide Tracking</h1>
          <p className="text-gray-500 mt-3">Track your KansRide trip in real-time</p>
        </div>

        <form onSubmit={handleTrack} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <div>
            <label htmlFor="trackingToken" className="block text-sm font-medium text-gray-700 mb-1">
              Tracking link
            </label>
            <input
              id="trackingToken"
              type="text"
              value={trackingToken}
              onChange={(e) => setTrackingToken(e.target.value)}
              placeholder="Paste the tracking link or token"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!trackingToken.trim()}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-sm"
          >
            Track Ride
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Use only a tracking link shared by a KansRide passenger
        </p>
      </div>
    </div>
  );
}
