import type { Locale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listEventBookingsAction } from "@/app/actions/admin-event-bookings";
import type { EventBookingStatus } from "@workspace/domain/event-bookings";

type SearchParams = Record<string, string | undefined>;

export default async function AdminEventBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("admin");

  const bookings = await listEventBookingsAction(sp.status as EventBookingStatus | undefined);

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("bookingsTitle")}</h1>

      <form method="get" className="flex flex-wrap gap-3 mb-6">
        <select name="status" defaultValue={sp.status ?? ""} className="border border-navy/15 rounded-lg px-3 py-2 text-sm">
          <option value="">{t("filterAll")}</option>
          {["quote_requested", "quoted", "confirmed", "completed", "cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="bg-navy text-white rounded-lg px-4 py-2 text-sm">{t("applyFilters")}</button>
      </form>

      <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
        <thead className="bg-navy/5 text-left">
          <tr>
            <th className="px-4 py-3">{t("bookingsColumnClient")}</th>
            <th className="px-4 py-3">{t("bookingsColumnEventType")}</th>
            <th className="px-4 py-3">{t("bookingsColumnDate")}</th>
            <th className="px-4 py-3">{t("bookingsColumnLocation")}</th>
            <th className="px-4 py-3">{t("bookingsColumnStatus")}</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id} className={`border-t border-navy/5 ${booking.location === "TBD" ? "bg-sin-red/5" : ""}`}>
              <td className="px-4 py-3">{booking.clientName}</td>
              <td className="px-4 py-3">{booking.eventType}</td>
              <td className="px-4 py-3">{booking.eventDate.toLocaleDateString()}</td>
              <td className="px-4 py-3">
                {booking.location === "TBD" ? (
                  <span className="text-sin-red font-bold">{t("bookingLocationTbdWarning")}</span>
                ) : (
                  booking.location
                )}
              </td>
              <td className="px-4 py-3">{booking.status}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/event-bookings/${booking.id}`} className="text-sin-red hover:underline">
                  {t("viewDetail")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
