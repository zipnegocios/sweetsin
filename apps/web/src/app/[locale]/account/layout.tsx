import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { auth } from "@/auth";

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session) {
    return redirect({ href: { pathname: "/login", query: { callbackUrl: "/account/orders" } }, locale });
  }

  const t = await getTranslations("account");

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <nav className="flex gap-4 text-[13px] text-navy/60 mb-8">
        <Link href="/account/orders" className="hover:text-sin-red">{t("navOrders")}</Link>
        <Link href="/account/settings" className="hover:text-sin-red">{t("navSettings")}</Link>
      </nav>
      {children}
    </div>
  );
}
