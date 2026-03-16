"use client";

import Image from "next/image";
import Link from "@/components/shared/LocalizedLink";

export interface Story {
  id: string;
  slug: string;
  title?: string;
  titleVi?: string | null;
  titleEn?: string | null;
  description?: string | null;
  descriptionVi?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl?: string | null;
  author?: { id?: string; name?: string | null };
  categories?: Array<{ category?: { id?: number; name?: string | null; slug?: string | null } }>;
}

export interface Banner {
  id: string;
  title?: string;
  titleVi?: string | null;
  titleEn?: string | null;
  imageUrl?: string | null;
  href?: string;
}

interface StoryDiscoveryBoardProps {
  featuredStories: Story[];
  newStories: Story[];
  banners: Banner[];
  lang: string;
}

const getLocalizedValue = (
  lang: string,
  vi?: string | null,
  en?: string | null,
  fallback?: string | null,
) => {
  if (lang === "en") return en || vi || fallback || "";
  return vi || en || fallback || "";
};

const sectionText = {
  vi: {
    featured: "Truyen noi bat",
    latest: "Moi cap nhat",
    readNow: "Doc ngay",
    favorite: "Yeu thich",
    empty: "Chua co du lieu",
    noSummary: "Noi dung tom tat dang duoc cap nhat.",
  },
  en: {
    featured: "Featured Stories",
    latest: "Latest Updates",
    readNow: "Read now",
    favorite: "Favorite",
    empty: "No stories available",
    noSummary: "Summary is being updated.",
  },
};

export default function StoryDiscoveryBoard({
  featuredStories,
  newStories,
  banners,
  lang,
}: StoryDiscoveryBoardProps) {
  const locale = lang === "en" ? "en" : "vi";
  const t = sectionText[locale];

  const highlightStory = featuredStories[0];
  const stripStories = featuredStories.slice(1, 7);
  const sideStories = newStories.slice(0, 9);
  const displayBanners = banners.slice(0, 2);

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100">{t.featured}</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {stripStories.map((story) => {
              const storyTitle = getLocalizedValue(lang, story.titleVi, story.titleEn, story.title);
              const authorName = story.author?.name || "";

              return (
                <Link
                  key={story.id}
                  href={`/story/${story.slug}`}
                  className="group rounded-2xl border border-gray-200 bg-white p-2 transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl">
                    <Image
                      src={story.thumbnailUrl || "/icon.svg"}
                      alt={storyTitle}
                      fill
                      sizes="160px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="pt-2">
                    <p className="line-clamp-2 text-xs font-semibold text-gray-900 dark:text-white">{storyTitle}</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-gray-500 dark:text-gray-400">{authorName}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          {displayBanners.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {displayBanners.map((banner) => {
                const bannerTitle = getLocalizedValue(lang, banner.titleVi, banner.titleEn, banner.title);

                return (
                  <Link
                    key={banner.id}
                    href={banner.href || "/explore"}
                    className="group relative h-28 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700"
                  >
                    <Image
                      src={banner.imageUrl || "/icon.svg"}
                      alt={bannerTitle}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/25 dark:bg-black/50 dark:opacity-90" />
                    <div className="relative z-10 flex h-full items-end p-3">
                      <p className="line-clamp-2 text-sm font-bold text-white">{bannerTitle}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {highlightStory ? (
            <article className="group overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="grid gap-4 p-4 md:grid-cols-5 md:gap-5 md:p-5">
                <Link href={`/story/${highlightStory.slug}`} className="md:col-span-2">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                    <Image
                      src={highlightStory.thumbnailUrl || "/icon.svg"}
                      alt={getLocalizedValue(lang, highlightStory.titleVi, highlightStory.titleEn, highlightStory.title)}
                      fill
                      sizes="(max-width: 768px) 100vw, 40vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                </Link>

                <div className="space-y-3 md:col-span-3">
                  <Link href={`/story/${highlightStory.slug}`}>
                    <h3 className="line-clamp-2 text-xl font-bold text-gray-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400">
                      {getLocalizedValue(lang, highlightStory.titleVi, highlightStory.titleEn, highlightStory.title)}
                    </h3>
                  </Link>

                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {highlightStory.author?.name || ""}
                    {highlightStory.categories?.[0]?.category?.name
                      ? ` • ${highlightStory.categories[0].category.name}`
                      : ""}
                  </p>

                  <p className="line-clamp-3 text-sm text-gray-700 dark:text-gray-300">
                    {getLocalizedValue(
                      lang,
                      highlightStory.descriptionVi,
                      highlightStory.descriptionEn,
                      highlightStory.description,
                    ) || t.noSummary}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link
                      href={`/story/${highlightStory.slug}`}
                      className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      {t.readNow}
                    </Link>
                    <button
                      type="button"
                      className="inline-flex items-center rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                    >
                      + {t.favorite}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {t.empty}
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700/50 dark:bg-gray-800">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700/50">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{t.latest}</h3>
          </div>

          <ul className="divide-y divide-gray-200 dark:divide-gray-700/50">
            {sideStories.length ? (
              sideStories.map((story) => {
                const storyTitle = getLocalizedValue(lang, story.titleVi, story.titleEn, story.title);

                return (
                  <li key={story.id}>
                    <Link
                      href={`/story/${story.slug}`}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                        <Image
                          src={story.thumbnailUrl || "/icon.svg"}
                          alt={storyTitle}
                          fill
                          sizes="64px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-bold text-gray-900 transition-colors group-hover:text-blue-500 dark:text-white dark:group-hover:text-blue-400">
                          {storyTitle}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">{story.author?.name || ""}</p>
                      </div>
                    </Link>
                  </li>
                );
              })
            ) : (
              <li className="px-4 py-6 text-sm text-gray-600 dark:text-gray-300">{t.empty}</li>
            )}
          </ul>
        </aside>
      </div>
    </section>
  );
}