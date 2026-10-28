import { z } from "zod/v4";

export const templateBodySchema = z.object({
  name: z.string(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int() })),
});

export const stockAddBodySchema = z.object({ productId: z.string().uuid(), quantity: z.number().int() });
export const stockQuantityBodySchema = z.object({ quantity: z.number().int() });
export const saveTemplateBodySchema = z.object({ name: z.string() });
export const stockMovementBodySchema = z.object({ quantity: z.number().int(), reason: z.string().optional() });
