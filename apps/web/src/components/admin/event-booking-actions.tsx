"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  quoteEventBookingAction,
  confirmEventBookingAction,
  cancelEventBookingAction,
  completeEventBookingAction,
} from "@/app/actions/admin-event-bookings";

export function EventBookingActions({ bookingId, location }: { bookingId: string; location: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [confirmError, setConfirmError] = useState(false);
  const locationIsTbd = location === "TBD";

  async function run(fn: () => Promise<void>) {
    setIsPending(true);
    try {
      await fn();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleConfirm() {
    setIsPending(true);
    setConfirmError(false);
    try {
      const result = await confirmEventBookingAction(bookingId);
      if ("error" in result) {
        setConfirmError(true);
        return;
      }
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <button disabled={isPending} onClick={() => run(() => quoteEventBookingAction(bookingId))} className="bg-navy text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">
          {t("bookingQuoteButton")}
        </button>
        <button
          disabled={isPending || locationIsTbd}
          onClick={handleConfirm}
          title={locationIsTbd ? t("bookingConfirmBlockedTbd") : undefined}
          className="bg-sin-red text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          {t("bookingConfirmButton")}
        </button>
        <button disabled={isPending} onClick={() => run(() => cancelEventBookingAction(bookingId))} className="text-[13px] text-navy/60 hover:text-sin-red disabled:opacity-50">
          {t("bookingCancelButton")}
        </button>
        <button disabled={isPending} onClick={() => run(() => completeEventBookingAction(bookingId))} className="text-[13px] text-navy/60 hover:text-sin-red disabled:opacity-50">
          {t("bookingCompleteButton")}
        </button>
      </div>
      {(confirmError || locationIsTbd) && (
        <p className="text-[12px] text-sin-red">{t("bookingConfirmBlockedTbd")}</p>
      )}
    </div>
  );
}
