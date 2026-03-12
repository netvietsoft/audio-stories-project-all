import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppProviders } from "@/providers/app-providers";
import AuthModal from "@/components/auth/AuthModal";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Web Truyện Audio",
  description: "Nền tảng nghe truyện audio chất lượng cao.",
  manifest: "/manifest.json",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#2563eb" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-icon.png" />
      </head>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground transition-colors duration-300 dark:bg-gray-950 dark:text-gray-100">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
            <AppProviders>
              {children}
              <AuthModal />
            </AppProviders>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

