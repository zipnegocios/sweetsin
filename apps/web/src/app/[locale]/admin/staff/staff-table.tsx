"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { User } from "@workspace/domain/users";
import { resetStaffPinAction, toggleStaffActiveAction } from "@/app/actions/admin-staff";

export function StaffTable({ staff }: { staff: User[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [revealedPin, setRevealedPin] = useState<{ userId: string; pin: string } | null>(null);

  async function handleResetPin(userId: string) {
    setPendingId(userId);
    try {
      const { plainPin } = await resetStaffPinAction(userId);
      setRevealedPin({ userId, pin: plainPin });
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleToggleActive(userId: string, isActive: boolean) {
    setPendingId(userId);
    try {
      await toggleStaffActiveAction(userId, !isActive);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (staff.length === 0) {
    return <p className="text-navy/40 text-sm">{t("staffEmpty")}</p>;
  }

  return (
    <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
      <thead className="bg-navy/5 text-left">
        <tr>
          <th className="px-4 py-3">{t("staffColumnName")}</th>
          <th className="px-4 py-3">{t("staffColumnEmail")}</th>
          <th className="px-4 py-3">{t("staffColumnRole")}</th>
          <th className="px-4 py-3">{t("staffColumnStatus")}</th>
          <th className="px-4 py-3">{t("staffColumnActions")}</th>
        </tr>
      </thead>
      <tbody>
        {staff.map((user) => (
          <tr key={user.id} className="border-t border-navy/5">
            <td className="px-4 py-3">{user.name}</td>
            <td className="px-4 py-3">{user.email}</td>
            <td className="px-4 py-3">{user.role}</td>
            <td className="px-4 py-3">{user.isActive ? "✓" : "✗"}</td>
            <td className="px-4 py-3 space-x-3">
              <button
                type="button"
                disabled={pendingId === user.id}
                onClick={() => handleResetPin(user.id)}
                className="text-sin-red hover:underline disabled:opacity-50"
              >
                {t("staffResetPinButton")}
              </button>
              <button
                type="button"
                disabled={pendingId === user.id}
                onClick={() => handleToggleActive(user.id, user.isActive)}
                className="text-navy/60 hover:underline disabled:opacity-50"
              >
                {user.isActive ? t("staffDeactivateButton") : t("staffActivateButton")}
              </button>
              {revealedPin?.userId === user.id && (
                <span className="text-sin-red">
                  {t("staffPinRevealPrefix")}: {revealedPin.pin}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
