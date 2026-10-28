import type { Locale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listEventBookingsAction } from "@/app/actions/admin-event-bookings";
import type { EventBookingStatus } from "@workspace/domain/event-bookings";
import { PageHeader } from "@/components/admin/page-header";

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
      <PageHeader title={t("bookingsTitle")} />

      <form method="get" className="flex flex-wrap gap-3 mb-6">
        <select name="status" defaultValue={sp.status ?? ""} className="admin-input">
          <option value="">{t("filterAll")}</option>
          {["quote_requested", "quoted", "confirmed", "completed", "cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="admin-btn">{t("applyFilters")}</button>
      </form>

      <div className="admin-card admin-enter overflow-x-auto"><table className="admin-table">
        <thead>
          <tr>
            <th>{t("bookingsColumnClient")}</th>
            <th>{t("bookingsColumnEventType")}</th>
            <th>{t("bookingsColumnDate")}</th>
            <th>{t("bookingsColumnLocation")}</th>
            <th>{t("bookingsColumnStatus")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id} className={`${booking.location === "TBD" ? "bg-sin-red/5" : ""}`}>
              <td>{booking.clientName}</td>
              <td>{booking.eventType}</td>
              <td>{booking.eventDate.toLocaleDateString()}</td>
              <td>
                {booking.location === "TBD" ? (
                  <span className="text-sin-red font-bold">{t("bookingLocationTbdWarning")}</span>
                ) : (
                  booking.location
                )}
              </td>
              <td>{booking.status}</td>
              <td>
                <Link href={`/admin/event-bookings/${booking.id}`} className="admin-link">
                  {t("viewDetail")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
