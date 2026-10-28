"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { registerCustomerAction } from "@/app/actions/register";
import { signInAction } from "@/app/actions/auth";
import { AuthField, AuthSubmit } from "./auth-field";

export function RegisterForm() {
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const result = await registerCustomerAction({ name, email, password, preferredLocale: locale as "en" | "es" });
      if ("error" in result) {
        setError(t("registerError"));
        return;
      }
      await signInAction({ email, password });
      router.push("/account/orders");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  const toggleLabels = { show: tAuth("showPassword"), hide: tAuth("hidePassword") };

  return (
    <form key={error} onSubmit={handleSubmit} className={`space-y-4 ${error ? "auth-shake" : ""}`}>
      <h1 className="font-serif font-bold text-navy text-4xl tracking-tight">{t("registerTitle")}</h1>
      <p className="text-navy/55 text-[15px] !mt-2 !mb-6">{tAuth("tagline")}</p>
      <AuthField label={t("namePlaceholder")} autoComplete="name" required value={name} onChange={setName} />
      <AuthField label={t("emailPlaceholder")} type="email" autoComplete="email" required value={email} onChange={setEmail} />
      <AuthField label={t("passwordPlaceholder")} type="password" autoComplete="new-password" required value={password} onChange={setPassword} toggleLabels={toggleLabels} />
      {error && <p role="alert" className="rounded-xl bg-sin-red/10 px-4 py-2.5 text-[13px] font-medium text-sin-red-dark">{error}</p>}
      <AuthSubmit pending={isSubmitting} label={t("registerButton")} pendingLabel={tAuth("loggingIn")} />
      <p className="pt-2 text-center text-[13px] text-navy/55">
        {t("haveAccount")} <Link href="/login" className="admin-link">{tAuth("loginTitle")}</Link>
      </p>
    </form>
  );
}
