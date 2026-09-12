import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hero");

  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-sweet-white text-navy">
      <p className="font-mono text-xs uppercase tracking-widest">
        Sweet Sin — {locale} — {t("ctaMenu")}
      </p>
    </main>
  );
}
