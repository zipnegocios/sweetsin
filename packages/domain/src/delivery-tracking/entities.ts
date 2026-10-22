export interface DeliveryLocation {
  userId: string;
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  recordedAt: Date;
}
