'use client';

import { useState } from 'react';
import { useUsers, useUserStatusMutation } from '@/lib/hooks';
import { formatDateTime } from '@/lib/datetime';

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useUsers(page);
  const statusMutation = useUserStatusMutation();

  const updateStatus = async (userId: string, status: 'active' | 'suspended') => {
    if (!window.confirm(`${status === 'suspended' ? 'Suspend' : 'Restore'} this account?`)) return;
    try {
      await statusMutation.mutateAsync({ userId, status });
    } catch (mutationError) {
      window.alert(mutationError instanceof Error ? mutationError.message : 'User status update failed');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">User Management</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-4">
          Failed to load users: {(error as Error).message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-full" /></td>
                </tr>
              ))
            ) : data?.data && data.data.length > 0 ? (
              data.data.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {user.firstName || user.lastName
                      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                      : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.phoneNumber}</td>
                  <td className="px-6 py-4">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      user.status === 'active' ? 'bg-green-100 text-green-700' :
                      user.status === 'suspended' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDateTime(user.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    {user.status === 'active' || user.status === 'suspended' ? (
                      <button
                        type="button"
                        onClick={() => void updateStatus(user.id, user.status === 'active' ? 'suspended' : 'active')}
                        disabled={statusMutation.isPending}
                        className={`text-xs font-semibold ${user.status === 'active' ? 'text-red-700' : 'text-green-700'}`}
                      >
                        {user.status === 'active' ? 'Suspend' : 'Restore'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-gray-500">
            Page {data.page} of {data.totalPages} ({data.total} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    passenger: 'bg-blue-100 text-blue-700',
    driver: 'bg-purple-100 text-purple-700',
    driver_applicant: 'bg-yellow-100 text-yellow-700',
    super_admin: 'bg-red-100 text-red-700',
    system_admin: 'bg-red-100 text-red-700',
    ops_admin: 'bg-orange-100 text-orange-700',
  };

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${colors[role] || 'bg-gray-100 text-gray-600'}`}>
      {role.replace(/_/g, ' ')}
    </span>
  );
}
