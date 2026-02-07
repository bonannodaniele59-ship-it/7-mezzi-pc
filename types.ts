
export enum TripStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED'
}

export interface MaintenanceReport {
  needed: boolean;
  description: string;
}

export interface Trip {
  id: string;
  vehicleId: string;
  volunteerId: string;
  driverName: string;
  startTime: string;
  endTime?: string;
  startKm: number;
  endKm?: number;
  destination: string;
  reason: string;
  notes: string;
  refuelingDone: boolean;
  maintenanceNeeded: MaintenanceReport;
  status: TripStatus;
  synced?: boolean;
  syncError?: boolean;
  icon?: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
}

export interface Volunteer {
  id: string;
  name: string;
  surname: string;
}

export interface AppSettings {
  googleScriptUrl: string;
  adminPassword?: string;
  notificationsEnabled: boolean;
  maxTripDurationHours: number;
  standardEndTime: string;
}

export const INITIAL_VEHICLES: Vehicle[] = [
  { id: '1', plate: 'PC 001 AA', model: 'Land Rover Defender' },
  { id: '2', plate: 'PC 002 BB', model: 'Fiat Ducato' },
  { id: '3', plate: 'PC 003 CC', model: 'Mitsubishi L200' },
];

export const INITIAL_VOLUNTEERS: Volunteer[] = [
  { id: 'v1', name: 'Mario', surname: 'Rossi' },
  { id: 'v2', name: 'Luigi', surname: 'Bianchi' },
];
