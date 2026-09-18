"use server";

import { z } from "zod";
import { updateUserPreferredLocale } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { auth } from "@/auth";

const localeSchema = z.enum(["en", "es"]);

export async function updatePreferredLocaleAction(locale: string): Promise<{ ok: true } | { error: string }> {
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return { error: "invalid_locale" };

  const session = await auth();
  if (!session) return { error: "unauthorized" };

  try {
    await updateUserPreferredLocale(new DrizzleUserRepository(), session.user.id, parsed.data);
    return { ok: true };
  } catch {
    return { error: "update_failed" };
  }
}
