import { z } from "zod/v4";

const positiveInt = z.number().int().positive();
const nullablePositiveInt = positiveInt.nullable();

export const capacitySettingsSchema = z
  .object({
    capacityEngineEnabled: z.boolean(),
    workAreaUnits: nullablePositiveInt,
    vehicleCapacityUnits: nullablePositiveInt,
    tripMinutes: nullablePositiveInt,
    maxDeliveryTrips: nullablePositiveInt,
    showEstimateToCustomer: z.boolean(),
  })
  .partial()
  .strict();

export const productRuleBodySchema = z.object({
  rule: z.object({
    soldOnline: z.boolean(),
    deliveryMaxQty: nullablePositiveInt,
    leadTimeMinutes: nullablePositiveInt,
    batchUnits: nullablePositiveInt,
    batchSeconds: nullablePositiveInt,
  }),
  steps: z.array(
    z.object({
      name: z.string().trim().min(1),
      seconds: positiveInt,
      mode: z.enum(["per_batch", "per_unit"]),
    }),
  ),
});

export const simulateBodySchema = z.object({
  lines: z.array(z.object({ productId: z.string().uuid(), quantity: positiveInt })).min(1),
  scheduledFor: z.iso.datetime({ offset: true }).optional(),
});
