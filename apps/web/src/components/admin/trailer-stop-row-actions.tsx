"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { completeTrailerStopAction, cancelTrailerStopAction } from "@/app/actions/admin-trailer-stops";

export function TrailerStopRowActions({ stopId, status }: { stopId: string; status: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handle(action: (id: string) => Promise<void>) {
    setIsPending(true);
    try {
      await action(stopId);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  if (status === "completed" || status === "cancelled") return null;

  return (
    <div className="flex gap-2">
      <button
        disabled={isPending}
        onClick={() => handle(completeTrailerStopAction)}
        className="text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50"
      >
        {t("stopsCompleteButton")}
      </button>
      <button
        disabled={isPending}
        onClick={() => handle(cancelTrailerStopAction)}
        className="text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50"
      >
        {t("stopsCancelButton")}
      </button>
    </div>
  );
}
