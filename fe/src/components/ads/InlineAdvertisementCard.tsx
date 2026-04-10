"use client";

import Image from "next/image";
import { useLocale } from "next-intl";

import type { AdvertisementItem } from "@/types/advertisement";

type InlineAdvertisementCardProps = {
  ad: AdvertisementItem;
  className?: string;
};

export default function InlineAdvertisementCard({ ad, className = "" }: InlineAdvertisementCardProps) {
  const locale = useLocale();

  const isExternal = /^https?:\/\//i.test(ad.targetUrl);
  const adHref = isExternal ? ad.targetUrl : ad.targetUrl.startsWith("/") ? ad.targetUrl : `/${ad.targetUrl}`;

  return (
    <a
      href={adHref}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noreferrer" : undefined}
      className={`group relative block w-full overflow-hidden rounded-2xl bg-white p-3 shadow-sm transition hover:shadow-md dark:bg-[#242526] ${className}`}
    >
      <span className="absolute right-3 top-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {locale === "en" ? "Sponsored" : "Tài trợ"}
      </span>
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-[#3a3b3c]">
          <Image src={ad.imageUrl} alt={ad.title} width={80} height={80} className="h-full w-full object-cover" unoptimized />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-pink-600 dark:text-pink-300">{ad.partnerName}</p>
          <h3 className="mt-1 line-clamp-2 text-sm font-bold text-gray-900 dark:text-gray-100">{ad.title}</h3>
          <div className="mt-2">
            <span className="inline-flex items-center rounded-full bg-pink-600 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-white transition group-hover:bg-pink-700">
              {locale === "en" ? "Shop now" : "Mua ngay"}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}
