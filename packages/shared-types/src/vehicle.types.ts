export type VehicleType = 'tricycle' | 'motorcycle' | 'car';

export type VehicleStatus = 'active' | 'inactive' | 'suspended' | 'decommissioned';

export interface Vehicle {
  id: string;
  registrationNumber: string;
  type: VehicleType;
  make?: string;
  model?: string;
  colour: string;
  year?: number;
  ownerId: string;
  status: VehicleStatus;
  createdAt: Date;
  updatedAt: Date;
}
