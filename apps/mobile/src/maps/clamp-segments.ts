import type { TrafficSegment } from "./types";

/** Acota los tramos (indices inclusivos) a una polilinea de pointCount puntos; descarta los que quedan vacios. */
export function clampSegments(segments: TrafficSegment[], pointCount: number): TrafficSegment[] {
  return segments.flatMap((s) => {
    const endIndex = Math.min(s.endIndex, pointCount - 1);
    return s.startIndex >= pointCount || endIndex <= s.startIndex ? [] : [{ ...s, endIndex }];
  });
}
