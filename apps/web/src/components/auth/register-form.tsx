"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { registerCustomerAction } from "@/app/actions/register";
import { signInAction } from "@/app/actions/auth";

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

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm mx-auto">
      <h1 className="font-serif font-bold text-navy text-2xl mb-4">{t("registerTitle")}</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} className="w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy outline-none focus:border-sin-red" />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} type="email" className="w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy outline-none focus:border-sin-red" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("passwordPlaceholder")} type="password" className="w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy outline-none focus:border-sin-red" />
      {error && <p className="text-sin-red text-[12px]">{error}</p>}
      <button type="submit" disabled={isSubmitting} className="w-full bg-sin-red text-white py-3.5 rounded-2xl font-bold text-[15px] disabled:opacity-50">
        {t("registerButton")}
      </button>
      <p className="text-[13px] text-navy/50 text-center">
        {t("haveAccount")} <Link href="/login" className="text-sin-red hover:underline">{tAuth("loginTitle")}</Link>
      </p>
    </form>
  );
}
