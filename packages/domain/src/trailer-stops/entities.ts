export type TrailerStopStatus = "scheduled" | "active" | "completed" | "cancelled";

export interface TrailerStop {
  id: string;
  location: string;
  lat: number;
  lng: number;
  startTime: Date;
  endTime: Date;
  status: TrailerStopStatus;
}
