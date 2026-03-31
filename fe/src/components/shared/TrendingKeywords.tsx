"use client";

import Link from "@/components/shared/LocalizedLink";
import { useLocale } from "next-intl";

type Keyword = {
  text?: string;
  textVi?: string;
  textEn?: string;
};

type TrendingKeywordsProps = {
  title?: string;
  keywords?: Keyword[];
};

const DEFAULT_KEYWORDS: Keyword[] = [
  { textVi: "huyền huyễn", textEn: "fantasy" },
  { textVi: "tu tiên", textEn: "cultivation" },
  { textVi: "xuyên không", textEn: "time travel" },
  { textVi: "ngôn tình", textEn: "romance" },
  { textVi: "harem", textEn: "harem" },
  { textVi: "võ hiệp", textEn: "martial arts" },
  { textVi: "chiến tranh", textEn: "war" },
  { textVi: "kiếm hiệp", textEn: "swordsman" },
  { textVi: "phục thù", textEn: "revenge" },
  { textVi: "yêu quái", textEn: "monster" },
  { textVi: "ma pháp", textEn: "magic" },
  { textVi: "hệ thống", textEn: "system" },
  { textVi: "trọng sinh", textEn: "rebirth" },
  { textVi: "học đường", textEn: "school" },
  { textVi: "tổng tài", textEn: "ceo" },
  { textVi: "cung đấu", textEn: "palace intrigue" },
  { textVi: "game", textEn: "game" },
  { textVi: "khoa huyễn", textEn: "sci-fi" },
  { textVi: "linh dị", textEn: "supernatural" },
  { textVi: "trinh thám", textEn: "detective" },
  { textVi: "hài hước", textEn: "comedy" },
  { textVi: "bi kịch", textEn: "tragedy" },
  { textVi: "phiêu lưu", textEn: "adventure" },
  { textVi: "gia đấu", textEn: "family conflict" },
];

export default function TrendingKeywords({ title, keywords = DEFAULT_KEYWORDS }: TrendingKeywordsProps) {
  const locale = useLocale();
  const isVietnamese = locale === "vi";

  const displayTitle = title || (isVietnamese ? "Từ khóa phổ biến" : "Trending Keywords");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">{displayTitle}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isVietnamese ? "Khám phá truyện theo từ khóa được yêu thích" : "Discover stories by popular keywords"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {keywords.map((keyword, index) => {
          const displayText = isVietnamese 
            ? (keyword.textVi || keyword.text || '') 
            : (keyword.textEn || keyword.text || '');
          
          if (!displayText) return null;
          
          const searchQuery = encodeURIComponent(displayText);

          return (
            <Link
              key={index}
              href={`/search?keyword=${searchQuery}`}
              className="rounded-full bg-pink-50 px-4 py-2 text-sm font-medium text-pink-600 transition-all hover:bg-pink-100 hover:text-pink-700 hover:shadow-sm dark:bg-pink-950/30 dark:text-pink-400 dark:hover:bg-pink-950/50 dark:hover:text-pink-300"
            >
              {displayText}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

