import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { Link } from "@/i18n/navigation";
import { viewUrlOrNull } from "@/infra/r2-staff-photo-storage";
import { PageHeader } from "@/components/admin/page-header";
import { StaffPhotoUploader } from "@/components/admin/staff-photo-uploader";
import { StaffEditForm } from "./staff-edit-form";

export const dynamic = "force-dynamic";

export default async function StaffEditPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const user = await new DrizzleUserRepository().findById(id);
  if (!user || (user.role !== "despachador" && user.role !== "delivery")) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/staff" className="admin-link mb-4 inline-block text-[13px]">
        {t("staffBackToList")}
      </Link>
      <PageHeader title={user.name} />
      <div className="admin-card admin-enter mb-6 p-6">
        <StaffPhotoUploader userId={user.id} name={user.name} initialUrl={await viewUrlOrNull(user.photoKey)} />
      </div>
      <StaffEditForm
        initial={{
          id: user.id,
          name: user.name,
          email: user.email ?? "",
          role: user.role,
          phone: user.phone ?? "",
          emergencyContactName: user.emergencyContactName ?? "",
          emergencyContactPhone: user.emergencyContactPhone ?? "",
          internalNotes: user.internalNotes ?? "",
          preferredLocale: user.preferredLocale,
          isActive: user.isActive,
        }}
      />
    </div>
  );
}
