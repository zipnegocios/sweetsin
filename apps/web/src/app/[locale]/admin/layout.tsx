import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session || session.user.role !== "admin") {
    redirect({ href: "/login", locale });
  }

  const t = await getTranslations("admin");

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between px-6 py-4 border-b border-navy/10 bg-white">
        <div className="flex items-center gap-6">
          <span className="font-serif font-bold text-navy">Sweet Sin Admin</span>
          <nav className="flex gap-4 text-[13px] text-navy/60">
            <Link href="/admin/orders" className="hover:text-sin-red">{t("navOrders")}</Link>
            <Link href="/admin/trailer-stops" className="hover:text-sin-red">{t("navTrailerStops")}</Link>
            <Link href="/admin/event-bookings" className="hover:text-sin-red">{t("navEventBookings")}</Link>
            <Link href="/admin/calendar" className="hover:text-sin-red">{t("navCalendar")}</Link>
          </nav>
        </div>
        <form action={async () => { "use server"; await signOutAction(); redirect({ href: "/login", locale }); }}>
          <button type="submit" className="text-[13px] text-navy/50 hover:text-sin-red transition-colors">
            Sign out
          </button>
        </form>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
