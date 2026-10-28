export type TrailerStopStatus = "scheduled" | "active" | "completed" | "cancelled";

export interface TrailerStop {
  id: string;
  location: string;
  lat: number;
  lng: number;
  startTime: Date;
  endTime: Date;
  status: TrailerStopStatus;
  originalLocation: string | null;
  originalLat: number | null;
  originalLng: number | null;
  originalStartTime: Date | null;
  originalEndTime: Date | null;
}

export type NewTrailerStop = Omit<
  TrailerStop,
  "id" | "originalLocation" | "originalLat" | "originalLng" | "originalStartTime" | "originalEndTime"
>;
