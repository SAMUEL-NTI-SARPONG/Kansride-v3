export type PaymentMethod =
  | 'cash'
  | 'mtn_mobile_money'
  | 'telecel_cash'
  | 'at_money'
  | 'wallet';

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
