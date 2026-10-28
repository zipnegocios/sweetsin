"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AuthField, AuthSubmit } from "./auth-field";
import { signInAction } from "@/app/actions/auth";
import { mergeCartOnLoginAction } from "@/app/actions/merge-cart";

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const result = await signInAction({ email, password });
      if ("error" in result) {
        setError(t("loginError"));
        return;
      }

      if (result.role === "customer") {
        try {
          const raw = window.localStorage.getItem("sweet-sin-cart");
          const guestItems = raw ? JSON.parse(raw) : [];
          const merged = await mergeCartOnLoginAction(guestItems);
          window.localStorage.setItem("sweet-sin-cart", JSON.stringify(merged));
        } catch {
          // localStorage puede fallar (modo privado) — el login igual continúa,
          // el carrito server-side queda como fuente de verdad de todos modos.
        }
      }

      const callbackUrl = searchParams.get("callbackUrl");
      const roleHome =
        result.role === "admin"
          ? "/admin"
          : result.role === "despachador"
            ? "/dispatch"
            : result.role === "delivery"
              ? "/delivery"
              : null;
      router.push(roleHome ?? callbackUrl ?? "/");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  const toggleLabels = { show: t("showPassword"), hide: t("hidePassword") };

  return (
    // key = error: al fallar el login se remonta el formulario y se reproduce la sacudida.
    <form key={error} onSubmit={handleSubmit} className={`space-y-4 ${error ? "auth-shake" : ""}`}>
      <h1 className="font-serif font-bold text-navy text-4xl tracking-tight">{t("loginTitle")}</h1>
      <p className="text-navy/55 text-[15px] !mt-2 !mb-6">{t("loginSubtitle")}</p>
      <AuthField label={t("emailPlaceholder")} type="email" autoComplete="email" required value={email} onChange={setEmail} />
      <AuthField label={t("passwordPlaceholder")} type="password" autoComplete="current-password" required value={password} onChange={setPassword} toggleLabels={toggleLabels} />
      {error && <p role="alert" className="rounded-xl bg-sin-red/10 px-4 py-2.5 text-[13px] font-medium text-sin-red-dark">{error}</p>}
      <AuthSubmit pending={isSubmitting} label={t("loginButton")} pendingLabel={t("loggingIn")} />
      <p className="pt-2 text-center text-[13px] text-navy/55">
        {t("noAccount")} <Link href="/register" className="admin-link">{t("createAccount")}</Link>
      </p>
    </form>
  );
}
