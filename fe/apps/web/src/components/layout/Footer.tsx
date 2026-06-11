import Link from "@/components/shared/LocalizedLink";
import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Facebook, Twitter, Instagram, Youtube, Mail, Phone, MapPin } from "lucide-react";

export default async function Footer() {
  const t = await getTranslations("Footer");
  const locale = await getLocale();
  const withLang = (path: string) => `/${locale}${path === "/" ? "" : path}`;

  return (
    <footer className="bg-gradient-to-b from-gray-50 to-white dark:from-[#242526] dark:to-[#161616]">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 2xl:px-14 pt-8 pb-32 md:pt-12 md:pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Cột 1: Logo và giới thiệu */}
          <div className="space-y-4">
            <Link href={withLang("/")} className="inline-block">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 dark:from-pink-400 dark:to-purple-400 bg-clip-text text-transparent">
                Netviet Audio
              </h2>
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {t("description")}
            </p>
            {/* Mạng xã hội */}
            <div className="flex space-x-4 pt-2">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-pink-600 dark:text-gray-400 dark:hover:text-pink-400 transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-pink-400 dark:text-gray-400 dark:hover:text-pink-300 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-pink-600 dark:text-gray-400 dark:hover:text-pink-400 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                aria-label="Youtube"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Cột 2: Khám phá */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              {t("explore")}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href={withLang("/stories")}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                >
                  {t("allStories")}
                </Link>
              </li>
              <li>
                <Link
                  href={withLang("/stories")}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                >
                  {t("categories")}
                </Link>
              </li>
              <li>
                <Link
                  href={withLang("/hall-of-fame")}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                >
                  {t("hallOfFame")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Cột 3: Hỗ trợ */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              {t("support")}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href={withLang("/about")}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                >
                  {t("about")}
                </Link>
              </li>
              <li>
                <Link
                  href={withLang("/contact")}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                >
                  {t("contact")}
                </Link>
              </li>
              <li>
                <Link
                  href={withLang("/faq")}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                >
                  {t("faq")}
                </Link>
              </li>
              <li>
                <Link
                  href={withLang("/help")}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                >
                  {t("help")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Cột 4: Pháp lý & Liên hệ */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              {t("legal")}
            </h3>
            <ul className="space-y-3 mb-6">
              <li>
                <Link
                  href={withLang("/terms")}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                >
                  {t("terms")}
                </Link>
              </li>
              <li>
                <Link
                  href={withLang("/privacy")}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                >
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link
                  href={withLang("/dmca")}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                >
                  {t("dmca")}
                </Link>
              </li>
            </ul>

            {/* Thông tin liên hệ */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <Mail className="w-4 h-4" />
                <span>support@audiotruyen.com</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <Phone className="w-4 h-4" />
                <span>+84 123 456 789</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dòng bản quyền */}
        <div className="mt-2 pt-8 bg-white/70 rounded-2xl px-4 dark:bg-[#3a3b3c]/35">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center md:text-left">
              &copy; {new Date().getFullYear()} AudioTruyen. {t("rightsReserved")}
            </p>
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <MapPin className="w-4 h-4" />
              <span>{t("location")}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
