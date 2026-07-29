// Shared date/time formatting for admin-web list/detail surfaces. Keeps a
// single surface-wide convention (date + time) so ride/user/subscription
// timestamps are rendered consistently instead of a mix of toLocaleDateString
// (date only) and toLocaleString (date + time).

export function formatDateTime(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}