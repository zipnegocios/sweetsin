"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { StaffAvatar } from "@/components/admin/staff-avatar";
import { resetStaffPinAction, toggleStaffActiveAction, deleteStaffAction } from "@/app/actions/admin-staff";

export interface StaffRow {
  id: string;
  name: string;
  email: string | null;
  role: "despachador" | "delivery";
  isActive: boolean;
  photoUrl: string | null;
}

export function StaffTable({ staff }: { staff: StaffRow[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
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

  async function handleDelete(userId: string) {
    setPendingId(userId);
    setDeleteError("");
    try {
      const result = await deleteStaffAction(userId);
      if (!result.ok) {
        setDeleteError(t("staffDeleteError"));
        return;
      }
      setConfirmingId(null);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (staff.length === 0) {
    return <p className="text-navy/40 text-sm">{t("staffEmpty")}</p>;
  }

  return (
    <div className="admin-card admin-enter overflow-x-auto"><table className="admin-table">
      <thead>
        <tr>
          <th>{t("staffColumnName")}</th>
          <th>{t("staffColumnEmail")}</th>
          <th>{t("staffColumnRole")}</th>
          <th>{t("staffColumnStatus")}</th>
          <th>{t("staffColumnActions")}</th>
        </tr>
      </thead>
      <tbody>
        {staff.map((user) => (
          <tr key={user.id} >
            <td>
              <Link href={`/admin/staff/${user.id}`} className="group flex items-center gap-3">
                <StaffAvatar name={user.name} photoUrl={user.photoUrl} size="sm" />
                <span className="font-medium text-navy transition-colors group-hover:text-sin-red">{user.name}</span>
              </Link>
            </td>
            <td>{user.email}</td>
            <td>{user.role === "despachador" ? t("staffFormRoleDespachador") : t("staffFormRoleDelivery")}</td>
            <td>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${user.isActive ? "bg-emerald-500/12 text-emerald-700" : "bg-navy/8 text-navy/60"}`}>
                <span className={`size-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-navy/40"}`} />
                {user.isActive ? t("staffStatusActive") : t("staffStatusInactive")}
              </span>
            </td>
            <td className="space-x-3 whitespace-nowrap">
              <Link href={`/admin/staff/${user.id}`} className="admin-link">{t("staffEditLink")}</Link>
              <button
                type="button"
                disabled={pendingId === user.id}
                onClick={() => handleResetPin(user.id)}
                className="admin-link disabled:opacity-50"
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
              {confirmingId === user.id ? (
                <span className="admin-enter inline-flex items-center gap-2 rounded-lg bg-sin-red/10 px-2.5 py-1">
                  <span className="text-[12px] font-medium text-sin-red-dark">{t("staffDeleteConfirm")}</span>
                  <button
                    type="button"
                    disabled={pendingId === user.id}
                    onClick={() => handleDelete(user.id)}
                    className="text-[12px] font-semibold text-sin-red-dark underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {t("staffDeleteConfirmYes")}
                  </button>
                  <button type="button" onClick={() => setConfirmingId(null)} className="text-[12px] text-navy/60 hover:text-navy">
                    {t("staffDeleteCancel")}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pendingId === user.id}
                  onClick={() => { setDeleteError(""); setConfirmingId(user.id); }}
                  className="text-sin-red-dark/80 hover:text-sin-red hover:underline disabled:opacity-50"
                >
                  {t("staffDeleteButton")}
                </button>
              )}
              {revealedPin?.userId === user.id && (
                <span className="text-sin-red">
                  {t("staffPinRevealPrefix")}: {revealedPin.pin}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>{deleteError && <p role="alert" className="px-5 py-3 text-[13px] text-sin-red">{deleteError}</p>}</div>
  );
}
