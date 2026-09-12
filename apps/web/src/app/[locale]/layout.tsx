import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Fraunces, DM_Sans, DM_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import "../globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const dmMono = DM_Mono({ variable: "--font-dm-mono", weight: ["400", "500"], subsets: ["latin"] });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await params;

  return {
    title: "Sweet Sin",
    description:
      "Colombian desserts crafted with memory, made with love, served from a trailer that knows no shame.",
    alternates: {
      // "en" (default) apunta a la raíz limpia "/"; el resto lleva su prefijo.
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, l === routing.defaultLocale ? "/" : `/${l}`]),
      ),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${fraunces.variable} ${dmSans.variable} ${dmMono.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
