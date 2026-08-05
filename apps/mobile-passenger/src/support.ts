export type SupportChannel = 'phone' | 'whatsapp' | 'email';

export function supportLink(channel: SupportChannel, configured: string | undefined, rideReference?: string): string | null {
  const value = configured?.trim();
  if (!value) return null;
  const suffix = rideReference ? ` KansRide ride reference: ${rideReference.slice(0, 8)}.` : '';
  if (channel === 'phone') return `tel:${value}`;
  if (channel === 'whatsapp') return `https://wa.me/${value.replace(/[^0-9+]/g, '').replace('+', '')}?text=${encodeURIComponent(`Hello KansRide.${suffix}`)}`;
  return `mailto:${value}?subject=${encodeURIComponent('KansRide support')}&body=${encodeURIComponent(`Hello KansRide.${suffix}`)}`;
}

export function supportAvailability(config: { phone?: string; whatsapp?: string; email?: string }): Record<SupportChannel, boolean> {
  return { phone: Boolean(config.phone?.trim()), whatsapp: Boolean(config.whatsapp?.trim()), email: Boolean(config.email?.trim()) };
}
