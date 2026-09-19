import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listStaffAction } from "@/app/actions/admin-staff";
import { StaffTable } from "./staff-table";
import { NewStaffForm } from "./new-staff-form";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const staff = await listStaffAction();

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("staffTitle")}</h1>
      <NewStaffForm />
      <StaffTable staff={staff} />
    </div>
  );
}
