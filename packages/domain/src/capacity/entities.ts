export type PrepStepMode = "per_batch" | "per_unit";

export interface ProductCapacityRule {
  productId: string;
  soldOnline: boolean;
  deliveryMaxQty: number | null;
  leadTimeMinutes: number | null;
  batchUnits: number | null;
  batchSeconds: number | null;
}

export interface PrepStep {
  id: string;
  productId: string;
  position: number;
  name: string;
  seconds: number;
  mode: PrepStepMode;
}

export type PrepStepInput = Omit<PrepStep, "id" | "productId">;

export interface CapacitySettings {
  capacityEngineEnabled: boolean;
  workAreaUnits: number | null;
  vehicleCapacityUnits: number | null;
  tripMinutes: number | null;
  maxDeliveryTrips: number | null;
  showEstimateToCustomer: boolean;
}
