import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session || session.user.role !== "admin") {
    redirect({ href: "/login", locale });
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between px-6 py-4 border-b border-navy/10 bg-white">
        <span className="font-serif font-bold text-navy">Sweet Sin Admin</span>
        <form action={async () => { "use server"; await signOutAction(); redirect({ href: "/login", locale }); }}>
          <button type="submit" className="text-[13px] text-navy/50 hover:text-sin-red transition-colors">
            Sign out
          </button>
        </form>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
