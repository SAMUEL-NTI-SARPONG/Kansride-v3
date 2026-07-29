// Canonical PaymentMethod union. The backend payment provider interface
// re-exports this same type so there is a single source of truth. 'wallet'
// was previously listed here but no backend adapter or client ever produced
// or accepted it — including a value with no implementation let a
// shared-types-typed client send a method the provider would silently reject
// (and the mock would silently accept). Removed until a real wallet adapter
// is implemented (V1.1+).
export type PaymentMethod =
  | 'cash'
  | 'mtn_mobile_money'
  | 'telecel_cash'
  | 'at_money';

export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'authorized'
  | 'successful'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'reversed'
  | 'refunded'
  | 'partially_refunded'
  | 'under_review';

export interface Payment {
  id: string;
  rideId?: string;
  subscriptionId?: string;
  userId: string;
  type: 'ride_fare' | 'subscription' | 'refund' | 'wallet_topup';
  amountPesewas: number;
  method: PaymentMethod;
  status: PaymentStatus;
  providerReference?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverSubscription {
  id: string;
  driverId: string;
  amountPesewas: number;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'expired' | 'pending' | 'cancelled';
  paymentId?: string;
  createdAt: Date;
}
