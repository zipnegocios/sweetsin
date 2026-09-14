"use server";

import { z } from "zod";
import { registerCustomer } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";

const registerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export async function registerCustomerAction(input: RegisterInput): Promise<{ error: string } | { ok: true }> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  try {
    await registerCustomer(new DrizzleUserRepository(), parsed.data);
    return { ok: true };
  } catch {
    return { error: "email_taken" };
  }
}
