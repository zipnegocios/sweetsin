"use server";

import type { AppSettings } from "@workspace/domain/settings";
import { DrizzleSettingsRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";
import { applySettingsUpdate } from "@/lib/settings";

type SettingsResult = { ok: true; settings: AppSettings } | { ok: false; error: string };

export async function getSettingsAction(): Promise<SettingsResult> {
  await requireAdmin();
  try {
    return { ok: true, settings: await new DrizzleSettingsRepository().get() };
  } catch {
    return { ok: false, error: "generic" };
  }
}

export async function updateSettingsAction(input: unknown): Promise<SettingsResult> {
  await requireAdmin();
  try {
    const settings = await applySettingsUpdate(input);
    return settings ? { ok: true, settings } : { ok: false, error: "Invalid settings" };
  } catch {
    return { ok: false, error: "generic" };
  }
}
