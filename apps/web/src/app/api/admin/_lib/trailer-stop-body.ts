import { z } from "zod/v4";

const isoDate = z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date");

export const stopBodySchema = z.object({
  location: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  startTime: isoDate,
  endTime: isoDate,
});

export const createStopBodySchema = stopBodySchema.extend({
  products: z.array(z.object({ productId: z.string().min(1), maxStock: z.number().int().min(0) })).default([]),
});

export function toStopInput(b: z.infer<typeof stopBodySchema>) {
  return { location: b.location, lat: b.lat, lng: b.lng, startTime: new Date(b.startTime), endTime: new Date(b.endTime) };
}
