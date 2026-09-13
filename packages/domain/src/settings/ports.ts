import type { AppSettings } from "./entities";

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  update(partial: Partial<AppSettings>): Promise<AppSettings>;
}
