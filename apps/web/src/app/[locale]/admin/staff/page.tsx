import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listStaffAction } from "@/app/actions/admin-staff";
import { viewUrlOrNull } from "@/infra/r2-staff-photo-storage";
import { StaffTable } from "./staff-table";
import { NewStaffForm } from "./new-staff-form";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  // DTO mínimo: el cliente nunca recibe pinHash/passwordHash ni la ficha privada.
  const staff = await Promise.all(
    (await listStaffAction()).map(async (u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as "despachador" | "delivery",
      isActive: u.isActive,
      photoUrl: await viewUrlOrNull(u.photoKey),
    })),
  );

  return (
    <div>
      <PageHeader title={t("staffTitle")} />
      <NewStaffForm />
      <StaffTable staff={staff} />
    </div>
  );
}
