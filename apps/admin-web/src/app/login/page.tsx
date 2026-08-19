'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearAdminSession, storeAdminSession } from '@/lib/api';

const ADMIN_WEB_ROLES = new Set([
  'finance_officer',
  'ops_admin',
  'system_admin',
  'super_admin',
  'auditor',
]);

interface VerifyOtpResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    role: string;
  };
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('233')) return `+${digits}`;
  if (digits.startsWith('0')) return `+233${digits.slice(1)}`;
  return `+233${digits}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const phoneNumber = normalizePhone(phone);
      if (!otpRequested) {
        await api.postPublic('/auth/request-otp', { phoneNumber });
        setOtpRequested(true);
        return;
      }

      const response = await api.postPublic<VerifyOtpResponse>('/auth/verify-otp', {
        phoneNumber,
        code,
      });
      if (!ADMIN_WEB_ROLES.has(response.user.role)) {
        clearAdminSession();
        throw new Error('This account is not provisioned for the admin dashboard.');
      }
      storeAdminSession(response.accessToken, response.refreshToken);
      router.replace('/dashboard');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F6F0E6] px-4 py-10">
      <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-24 bottom-12 h-72 w-72 rounded-full bg-secondary/15 blur-3xl" />
      <div className="relative w-full max-w-md rounded-3xl border border-[#DDD4C4] bg-[#FFFDF8] p-7 shadow-panel sm:p-9">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-base font-black text-white shadow-control">KR</div>
          <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-primary-dark">KansRide</h1>
          <p className="mt-2 text-sm text-[#61736F]">Sign in to the operations dashboard</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone number
            </label>
            <input
              type="tel"
              required
              disabled={otpRequested || loading}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-xl border border-[#D8CFBF] bg-white px-4 py-3 text-[#173633] transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-[#ECE7DD] disabled:text-[#788783]"
              placeholder="024 XXX XXXX"
            />
          </div>
          {otpRequested && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                className="w-full rounded-xl border border-[#D8CFBF] bg-white px-4 py-3 text-[#173633] transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="6 digits"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3.5 font-bold text-white shadow-control transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-[#789C97] disabled:text-white/90 disabled:shadow-none"
          >
            {loading ? 'Please wait…' : otpRequested ? 'Verify and sign in' : 'Send OTP'}
          </button>
          {otpRequested && (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setOtpRequested(false);
                setCode('');
                setError('');
              }}
              className="w-full rounded-lg py-1 text-sm font-semibold text-[#526963] hover:text-primary"
            >
              Use a different number
            </button>
          )}
        </form>
        <p className="mt-6 text-center text-xs leading-5 text-[#6A7B76]">
          Access requires a pre-provisioned staff account.
        </p>
      </div>
    </div>
  );
}
