import { redirect } from "next/navigation";

import { defaultLocale } from "@/i18n";

// BE redirects Google OAuth back to "/auth/google/callback" (no locale prefix),
// which sits outside the [lang] segment and therefore has no NextIntlClientProvider.
// Bounce it into the locale-aware route, preserving the OAuth query params.
export default async function GoogleCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value) && value.length > 0) qs.set(key, value[0]);
  }
  const query = qs.toString();
  redirect(`/${defaultLocale}/auth/google/callback${query ? `?${query}` : ""}`);
}
