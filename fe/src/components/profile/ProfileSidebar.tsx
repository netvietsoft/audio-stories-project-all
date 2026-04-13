"use client";

import Link from "@/components/shared/LocalizedLink";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight, CreditCard, Heart, History, Home, ListMusic, Music2, Settings, Wallet } from "lucide-react";

const isRouteActive = (pathname: string, currentLang: string, href: string) => {
  const fullPath = `/${currentLang}${href}`;

  if (href === "/profile") {
    return pathname === fullPath;
  }

  return pathname === fullPath || pathname.startsWith(`${fullPath}/`);
};

export default function ProfileSidebar() {
  const t = useTranslations("ProfilePage");
  const params = useParams<{ lang?: string }>();
  const pathname = usePathname();
  const currentLang = params?.lang === "en" ? "en" : "vi";

  const menuItems = [
    {
      href: "/profile",
      label: t("recentActivity"),
      icon: Home,
    },
    {
      href: "/profile/favorites",
      label: t("favoriteStories"),
      icon: Heart,
    },
    {
      href: "/profile/history",
      label: t("listeningHistory"),
      icon: History,
    },
    {
      href: "/profile/music-history",
      label: t("musicHistory"),
      icon: Music2,
    },
    {
      href: "/profile/playlists",
      label: t("myPlaylists"),
      icon: ListMusic,
    },
    {
      href: "/profile/transactions",
      label: t("transactionHistory"),
      icon: CreditCard,
    },
    {
      href: "/profile/settings",
      label: t("securitySettings"),
      icon: Settings,
    },
    {
      href: "/topup",
      label: t("topUpCredits"),
      icon: Wallet,
    },
  ];

  return (
    <aside className="rounded-none border-x-0 border-y border-gray-200 bg-white p-4 shadow-none dark:border-zinc-800 dark:bg-[#232325] md:rounded-2xl md:border md:shadow-sm">
      <p className="px-2 pb-3 text-xs font-bold uppercase tracking-widest text-gray-400">{t("management")}</p>
      <nav className="space-y-1.5">
        {menuItems.map((item) => {
          const active = isRouteActive(pathname, currentLang, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-300"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-[#2b2b2d]"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${
                  active ? "text-pink-600 dark:text-pink-400" : "text-gray-400 dark:text-gray-500"
                }`}
              />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <ChevronRight
                className={`h-4 w-4 transition-transform ${
                  active ? "text-pink-500" : "text-gray-300 group-hover:translate-x-0.5"
                }`}
              />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
