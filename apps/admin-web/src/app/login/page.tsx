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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">KansRide</h1>
          <p className="text-gray-500 mt-2">Admin Dashboard</p>
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
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100"
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
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="6 digits"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark transition disabled:opacity-60"
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
              className="w-full text-sm text-gray-600"
            >
              Use a different number
            </button>
          )}
        </form>
        <p className="text-xs text-gray-500 mt-6 text-center">
          Access requires a pre-provisioned staff account.
        </p>
      </div>
    </div>
  );
}
