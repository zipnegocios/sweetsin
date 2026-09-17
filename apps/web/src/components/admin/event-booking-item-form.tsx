"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { addEventBookingItemAction } from "@/app/actions/admin-event-bookings";

export function EventBookingItemForm({ bookingId }: { bookingId: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [priceCents, setPriceCents] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addEventBookingItemAction(bookingId, { description, quantity, agreedUnitPriceCents: priceCents });
      setDescription("");
      setQuantity(1);
      setPriceCents(0);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div className="flex-1">
        <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("bookingItemDescription")}</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("bookingItemQuantity")}</label>
        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-20 border border-navy/15 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("bookingItemPrice")}</label>
        <input type="number" min={0} value={priceCents} onChange={(e) => setPriceCents(Number(e.target.value))} className="w-28 border border-navy/15 rounded-lg px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={isSubmitting} className="bg-sin-red text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">
        {t("bookingAddItemButton")}
      </button>
    </form>
  );
}
