import { notFound } from "next/navigation";
import { setRequestLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import type { Metadata } from "next";

import { isValidLocale } from "@/i18n";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppProviders } from "@/providers/app-providers";
import { AudioProvider } from "@/providers/audio-provider";
import AuthModal from "@/components/auth/AuthModal";



export const metadata: Metadata = {
  title: "Web Truyện Audio",
  description: "Nền tảng nghe truyện audio chất lượng cao.",
  manifest: "/manifest.json",
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
  // Using direct import to ensure correct messages are loaded for the locale segment
  const messages = (await import(`../../../messages/${lang}.json`)).default;

  return (
    <NextIntlClientProvider locale={lang} messages={messages}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <AppProviders>
          <AudioProvider>
            {children}
            <AuthModal />
          </AudioProvider>
        </AppProviders>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
