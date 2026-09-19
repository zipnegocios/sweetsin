"use server";

import { registerStaffUser, resetStaffPin } from "@workspace/domain/users";
import type { User, UserRole } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";

export async function listStaffAction(): Promise<User[]> {
  await requireAdmin();
  const repo = new DrizzleUserRepository();
  const [despachadores, deliveries] = await Promise.all([
    repo.listByRole("despachador"),
    repo.listByRole("delivery"),
  ]);
  return [...despachadores, ...deliveries];
}

export async function createStaffAction(input: {
  name: string;
  email: string;
  role: Extract<UserRole, "despachador" | "delivery">;
  password: string;
}): Promise<{ ok: true; plainPin: string } | { ok: false; message: string }> {
  await requireAdmin();
  try {
    const { plainPin } = await registerStaffUser(new DrizzleUserRepository(), input);
    return { ok: true, plainPin };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function resetStaffPinAction(userId: string): Promise<{ plainPin: string }> {
  await requireAdmin();
  const plainPin = await resetStaffPin(new DrizzleUserRepository(), userId);
  return { plainPin };
}

export async function toggleStaffActiveAction(userId: string, isActive: boolean): Promise<void> {
  await requireAdmin();
  await new DrizzleUserRepository().update(userId, { isActive });
}
