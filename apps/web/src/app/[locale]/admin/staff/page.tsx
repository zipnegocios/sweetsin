import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listStaffAction } from "@/app/actions/admin-staff";
import { StaffTable } from "./staff-table";
import { NewStaffForm } from "./new-staff-form";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const staff = await listStaffAction();

  return (
    <div>
      <PageHeader title={t("staffTitle")} />
      <NewStaffForm />
      <StaffTable staff={staff} />
    </div>
  );
}
