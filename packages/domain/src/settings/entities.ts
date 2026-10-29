export interface AppSettings {
  deliveryFeeCents: number;
  deliveryEvidenceRequired: boolean;
  requireStockConfirmationOnOpen: boolean;
  allowMultipleActiveStops: boolean;
  liveStockEnabled: boolean;
  autoSoldOutEnabled: boolean;
  timingEnabled: boolean;
  showPerStaffBreakdown: boolean;
  capacityEngineEnabled: boolean;
  workAreaUnits: number | null;
  vehicleCapacityUnits: number | null;
  tripMinutes: number | null;
  maxDeliveryTrips: number | null;
  showEstimateToCustomer: boolean;
  deliveryStockControlEnabled: boolean;
  deliveryStockMode: "separate" | "shared";
}
