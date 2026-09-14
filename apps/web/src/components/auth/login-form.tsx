"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { signInAction } from "@/app/actions/auth";

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
      const callbackUrl = searchParams.get("callbackUrl");
      router.push(result.role === "admin" ? "/admin" : callbackUrl || "/");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm mx-auto">
      <h1 className="font-serif font-bold text-navy text-2xl mb-4">{t("loginTitle")}</h1>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("emailPlaceholder")}
        type="email"
        className="w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy outline-none focus:border-sin-red"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("passwordPlaceholder")}
        type="password"
        className="w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy outline-none focus:border-sin-red"
      />
      {error && <p className="text-sin-red text-[12px]">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-sin-red text-white py-3.5 rounded-2xl font-bold text-[15px] disabled:opacity-50"
      >
        {t("loginButton")}
      </button>
    </form>
  );
}
