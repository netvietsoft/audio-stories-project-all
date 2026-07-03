"use client";

import { ChevronRight, Home } from "lucide-react";
import Link from "@/components/shared/LocalizedLink";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  lang?: string;
  className?: string;
};

export default function Breadcrumbs({ items, lang = "vi", className = "" }: BreadcrumbsProps) {
  const homeText = lang === "en" ? "Home" : "Trang chủ";

  return (
    <nav
      aria-label="Breadcrumb"
      className={`w-full py-3 text-sm text-gray-500 dark:text-gray-400 ${className}`.trim()}
    >
      <ol className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <li className="flex items-center">
          <Link href={`/${lang}`} className="inline-flex items-center hover:text-pink-600 transition-colors">
            <Home className="mr-1 h-4 w-4" />
            <span>{homeText}</span>
          </Link>
        </li>

        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
            {item.href ? (
              <Link
                href={item.href}
                className="max-w-[130px] truncate hover:text-pink-600 transition-colors sm:max-w-xs"
              >
                {item.label}
              </Link>
            ) : (
              <span className="max-w-[130px] truncate font-medium text-gray-900 dark:text-gray-100 sm:max-w-xs">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
