import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listEmailLogsAction } from "@/app/actions/admin-email-logs";

export default async function AdminEmailLogsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const logs = await listEmailLogsAction();

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("emailLogsTitle")}</h1>
      {logs.length === 0 ? (
        <p className="text-navy/40 text-sm">{t("emailLogsEmpty")}</p>
      ) : (
        <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
          <thead className="bg-navy/5 text-left">
            <tr>
              <th className="px-4 py-3">{t("emailLogsColumnTo")}</th>
              <th className="px-4 py-3">{t("emailLogsColumnType")}</th>
              <th className="px-4 py-3">{t("emailLogsColumnLocale")}</th>
              <th className="px-4 py-3">{t("emailLogsColumnStatus")}</th>
              <th className="px-4 py-3">{t("emailLogsColumnDate")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-navy/5">
                <td className="px-4 py-3">{log.to}</td>
                <td className="px-4 py-3">{log.type}</td>
                <td className="px-4 py-3">{log.locale}</td>
                <td className="px-4 py-3">{log.status}</td>
                <td className="px-4 py-3">{log.createdAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
