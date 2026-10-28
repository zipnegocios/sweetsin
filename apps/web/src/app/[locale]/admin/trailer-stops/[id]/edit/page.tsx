import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { TrailerStopForm } from "@/components/admin/trailer-stop-form";
import { PageHeader } from "@/components/admin/page-header";

export default async function EditTrailerStopPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const stop = await new DrizzleTrailerStopRepository().findById(id);
  if (!stop || stop.status === "completed") notFound();

  return (
    <div>
      <PageHeader title={t("stopsEditTitle")} />
      <TrailerStopForm products={[]} stop={stop} />
    </div>
  );
}
