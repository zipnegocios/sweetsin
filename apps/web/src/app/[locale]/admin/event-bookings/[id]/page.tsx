import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { DrizzleEventBookingRepository } from "@workspace/db/repositories";
import { EventBookingActions } from "@/components/admin/event-booking-actions";
import { EventBookingItemForm } from "@/components/admin/event-booking-item-form";
import { EventBookingDetailsForm } from "@/components/admin/event-booking-details-form";

export default async function EventBookingDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const booking = await new DrizzleEventBookingRepository().findById(id);
  if (!booking) notFound();

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{booking.clientName}</h1>

      <div className="bg-white rounded-xl p-5 mb-6">
        <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("bookingsColumnClient")}</h2>
        <p className="text-sm">{booking.clientName} — {booking.clientEmail} — {booking.clientPhone}</p>
        <p className="text-sm mt-1">
          {t("bookingsColumnLocation")}: {booking.location === "TBD" ? (
            <span className="text-sin-red font-bold">{t("bookingLocationTbdWarning")}</span>
          ) : booking.location}
        </p>
      </div>

      <div className="bg-white rounded-xl p-5 mb-6">
        <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-3">{t("stopFormLocation")} / {t("bookingsColumnDate")}</h2>
        <EventBookingDetailsForm
          bookingId={booking.id}
          location={booking.location}
          startTime={booking.startTime}
          endTime={booking.endTime}
          estimatedGuests={booking.estimatedGuests}
        />
      </div>

      <div className="bg-white rounded-xl p-5 mb-6">
        <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-3">{t("bookingAddItemTitle")}</h2>
        <ul className="text-sm space-y-1 mb-4">
          {booking.items.map((item, i) => (
            <li key={i}>{item.quantity}x {item.description} — ${(item.agreedUnitPriceCents / 100).toFixed(2)} c/u</li>
          ))}
        </ul>
        <EventBookingItemForm bookingId={booking.id} />
      </div>

      <div className="bg-white rounded-xl p-5">
        <EventBookingActions bookingId={booking.id} location={booking.location} />
      </div>
    </div>
  );
}
