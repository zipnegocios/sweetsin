import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { adoptLocale } from "./locale";
import { parseProfile, type StaffProfile } from "./profile";

export type ProfileState = { status: "loading" | "ready" | "error"; profile: StaffProfile | null; reload: () => void };

/** Perfil público del staff (nombre y foto firmada). Un fallo nunca rompe la pantalla: el avatar usa las iniciales. */
export function useProfile(): ProfileState {
  const [state, setState] = useState<Omit<ProfileState, "reload">>({ status: "loading", profile: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/mobile/auth/me")
      .then(async (res) => {
        const profile = res.ok ? parseProfile(await res.json()) : null;
        if (cancelled) return;
        if (profile?.locale) adoptLocale(profile.locale); // el idioma del admin manda en el teléfono
        setState({ status: profile ? "ready" : "error", profile });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", profile: null });
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return { ...state, reload: () => setVersion((v) => v + 1) };
}
