// Business rules
export const DRIVER_SUBSCRIPTION_AMOUNT_PESEWAS = 1000; // GHS 10 = 1000 pesewas
export const DRIVER_SUBSCRIPTION_DURATION_HOURS = 24;

// OTP
export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RATE_LIMIT_WINDOW_MINUTES = 15;
export const OTP_RATE_LIMIT_MAX_REQUESTS = 3;

// JWT
export const JWT_ACCESS_EXPIRY = '15m';
export const JWT_REFRESH_EXPIRY = '7d';

// Dispatch
export const MAX_DISPATCH_RADIUS_KM = 5;
export const DISPATCH_INITIAL_RADIUS_KM = 2;
export const DISPATCH_TIMEOUT_SECONDS = 30;
export const DRIVER_RESPONSE_TIMEOUT_SECONDS = 15;

// Fare (all in pesewas)
export const FARE_BASE_PESEWAS = 200; // GHS 2
export const FARE_PER_KM_PESEWAS = 150; // GHS 1.50
export const FARE_PER_MINUTE_PESEWAS = 10; // GHS 0.10
export const FARE_MINIMUM_PESEWAS = 300; // GHS 3

// Location
export const DRIVER_LOCATION_UPDATE_INTERVAL_MS = 10000; // 10 seconds
export const LOCATION_STALE_THRESHOLD_MINUTES = 5;
