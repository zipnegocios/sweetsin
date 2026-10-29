export type TrailerStopStatus = "scheduled" | "active" | "completed" | "cancelled";

export type TrailerStopKind = "trailer" | "delivery";

export interface TrailerStop {
  id: string;
  location: string;
  lat: number;
  lng: number;
  startTime: Date;
  endTime: Date;
  status: TrailerStopStatus;
  kind: TrailerStopKind;
  originalLocation: string | null;
  originalLat: number | null;
  originalLng: number | null;
  originalStartTime: Date | null;
  originalEndTime: Date | null;
}

export type NewTrailerStop = Omit<
  TrailerStop,
  "id" | "kind" | "originalLocation" | "originalLat" | "originalLng" | "originalStartTime" | "originalEndTime"
> & { kind?: TrailerStopKind };
