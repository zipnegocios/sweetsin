import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listEmailLogsAction } from "@/app/actions/admin-email-logs";
import { PageHeader } from "@/components/admin/page-header";

export default async function AdminEmailLogsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const logs = await listEmailLogsAction();

  return (
    <div>
      <PageHeader title={t("emailLogsTitle")} />
      {logs.length === 0 ? (
        <p className="text-navy/40 text-sm">{t("emailLogsEmpty")}</p>
      ) : (
        <div className="admin-card admin-enter overflow-x-auto"><table className="admin-table">
          <thead>
            <tr>
              <th>{t("emailLogsColumnTo")}</th>
              <th>{t("emailLogsColumnType")}</th>
              <th>{t("emailLogsColumnLocale")}</th>
              <th>{t("emailLogsColumnStatus")}</th>
              <th>{t("emailLogsColumnDate")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} >
                <td>{log.to}</td>
                <td>{log.type}</td>
                <td>{log.locale}</td>
                <td>{log.status}</td>
                <td>{log.createdAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
