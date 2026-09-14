import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream px-6">
      <RegisterForm />
    </main>
  );
}
