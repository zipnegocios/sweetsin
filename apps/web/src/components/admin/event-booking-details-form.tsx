"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updateEventBookingDetailsAction } from "@/app/actions/admin-event-bookings";

function toDatetimeLocal(date: Date): string {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 16);
}

export function EventBookingDetailsForm({
  bookingId,
  location,
  startTime,
  endTime,
  estimatedGuests,
}: {
  bookingId: string;
  location: string;
  startTime: Date;
  endTime: Date;
  estimatedGuests: number;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [formLocation, setFormLocation] = useState(location === "TBD" ? "" : location);
  const [formStart, setFormStart] = useState(toDatetimeLocal(startTime));
  const [formEnd, setFormEnd] = useState(toDatetimeLocal(endTime));
  const [guests, setGuests] = useState(estimatedGuests);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateEventBookingDetailsAction(bookingId, {
        location: formLocation,
        startTime: new Date(formStart).toISOString(),
        endTime: new Date(formEnd).toISOString(),
        estimatedGuests: guests,
      });
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        value={formLocation}
        onChange={(e) => setFormLocation(e.target.value)}
        placeholder={t("stopFormLocation")}
        required
        className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex gap-3">
        <input type="datetime-local" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="flex-1 border border-navy/15 rounded-lg px-3 py-2 text-sm" />
        <input type="datetime-local" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="flex-1 border border-navy/15 rounded-lg px-3 py-2 text-sm" />
      </div>
      <input type="number" min={1} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-32 border border-navy/15 rounded-lg px-3 py-2 text-sm" />
      <button type="submit" disabled={isSubmitting} className="bg-navy text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">
        {t("saveStatus")}
      </button>
    </form>
  );
}
