import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { parseProfile, type StaffProfile } from "./profile";

export type ProfileState = { status: "loading" | "ready" | "error"; profile: StaffProfile | null };

/** Perfil público del staff (nombre y foto firmada). Un fallo nunca rompe la pantalla: el avatar usa las iniciales. */
export function useProfile(): ProfileState {
  const [state, setState] = useState<ProfileState>({ status: "loading", profile: null });

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/mobile/auth/me")
      .then(async (res) => {
        const profile = res.ok ? parseProfile(await res.json()) : null;
        if (!cancelled) setState({ status: profile ? "ready" : "error", profile });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", profile: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
