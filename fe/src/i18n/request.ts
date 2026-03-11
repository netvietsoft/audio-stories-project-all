import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isValidLocale, localeCookieName } from "../i18n";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const localeFromCookie = cookieStore.get(localeCookieName)?.value;
  const locale = isValidLocale(localeFromCookie) ? localeFromCookie : defaultLocale;

  const messageLoaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
    vi: () => import("../../messages/vi.json"),
    en: () => import("../../messages/en.json"),
  };

  const loader = messageLoaders[locale] ?? messageLoaders["vi"];

  return {
    locale,
    messages: (await loader()).default,
  };
});
