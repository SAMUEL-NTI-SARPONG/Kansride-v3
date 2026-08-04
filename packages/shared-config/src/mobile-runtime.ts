const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function validatePhysicalDeviceUrl(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required for physical-device mode`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
  if (LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(`${name} must not point to localhost or loopback in physical-device mode`);
  }
  return value.replace(/\/$/, '');
}

export function mobileRuntimeUrl(
  name: string,
  value: string | undefined,
  fallback: string,
): string {
  if (process.env.EXPO_PUBLIC_DEVICE_MODE === 'physical') {
    return validatePhysicalDeviceUrl(name, value);
  }
  return value || fallback;
}
