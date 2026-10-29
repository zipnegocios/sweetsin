import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { AdminSidebar, type AdminNavItem } from "@/components/admin/admin-sidebar";

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

  const items: AdminNavItem[] = [
    { href: "/admin/orders", label: t("navOrders"), icon: "orders" },
    { href: "/admin/trailer-stops", label: t("navTrailerStops"), icon: "stops" },
    { href: "/admin/jornadas", label: t("navJornadas"), icon: "jornadas" },
    { href: "/admin/stock-templates", label: t("navStockTemplates"), icon: "templates" },
    { href: "/admin/event-bookings", label: t("navEventBookings"), icon: "events" },
    { href: "/admin/calendar", label: t("navCalendar"), icon: "calendar" },
    { href: "/admin/email-logs", label: t("navEmailLogs"), icon: "emails" },
    { href: "/admin/staff", label: t("navStaff"), icon: "staff" },
    { href: "/admin/reports/fulfillment", label: t("navReports"), icon: "reports" },
    { href: "/admin/capacity", label: t("navCapacity"), icon: "capacity" },
    { href: "/admin/settings", label: t("navSettings"), icon: "settings" },
  ];

  return (
    <div className="min-h-screen bg-cream md:flex">
      <AdminSidebar
        items={items}
        labels={{
          collapse: t("collapseMenu"),
          expand: t("expandMenu"),
          open: t("openMenu"),
          close: t("closeMenu"),
          signOut: t("signOut"),
          switchLanguage: t("switchLanguage"),
        }}
        signOutAction={async () => {
          "use server";
          await signOutAction();
          redirect({ href: "/login", locale });
        }}
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}
