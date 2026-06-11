import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import type { Metadata } from "next";

import { isValidLocale } from "@/i18n";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppProviders } from "@/providers/app-providers";
import AdminShellLayout from "@/components/admin/AdminShellLayout";

export const metadata: Metadata = {
  title: "Audio Stories Admin",
  description: "Audio Stories admin console.",
};

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
};

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { lang } = await params;

  if (!isValidLocale(lang)) {
    notFound();
  }

  setRequestLocale(lang);
  const messages = (await import(`../../../messages/${lang}.json`)).default;

  return (
    <NextIntlClientProvider locale={lang} messages={messages}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <AppProviders><AdminShellLayout>{children}</AdminShellLayout></AppProviders>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
