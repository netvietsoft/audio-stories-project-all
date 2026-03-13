import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { isValidLocale } from "@/i18n";

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

  return children;
}
