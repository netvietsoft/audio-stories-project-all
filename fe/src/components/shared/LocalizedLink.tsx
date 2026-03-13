"use client";

import NextLink, { type LinkProps } from "next/link";
import { useParams } from "next/navigation";

import { defaultLocale, isValidLocale } from "@/i18n";

type LocalizedLinkProps = Omit<React.ComponentProps<typeof NextLink>, "href"> & {
  href: LinkProps["href"];
};

const localePrefixMatcher = /^\/(vi|en)(?=\/|$)/;

const withLocalePrefix = (href: string, locale: string) => {
  if (!href.startsWith("/") || href.startsWith("//") || localePrefixMatcher.test(href)) {
    return href;
  }

  return `/${locale}${href === "/" ? "" : href}`;
};

export default function LocalizedLink({ href, ...props }: LocalizedLinkProps) {
  const params = useParams<{ lang?: string }>();
  const locale = isValidLocale(params?.lang) ? params.lang : defaultLocale;

  if (typeof href !== "string") {
    return <NextLink href={href} {...props} />;
  }

  return <NextLink href={withLocalePrefix(href, locale)} {...props} />;
}
