import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { JsonLd } from "@/components/seo/JsonLd";
import { cleanChapterTitle } from "@/lib/formatChapterTitle";
import Breadcrumbs from "@/components/Breadcrumbs";
import StoryChapterClient from "./_components/StoryChapterClient";
import { unwrapData } from "@/lib/api/unwrap";

type StoryMeta = {
  title: string;
  titleVi?: string;
  titleEn?: string;
  slug: string;
  description: string | null;
  descriptionVi?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl: string | null;
  author?: { name: string };
  chapters: Array<{
    chapterNumber: number;
    title: string;
    titleVi?: string;
    titleEn?: string;
    description?: string | null;
    descriptionVi?: string | null;
    descriptionEn?: string | null;
  }>;
};

const localizedValue = (locale: string, vi?: string | null, en?: string | null, fallback?: string | null) => {
  if (locale === "en") return en || vi || fallback || "";
  return vi || en || fallback || "";
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://webtruyen.vn";

async function fetchStoryMeta(slug: string): Promise<StoryMeta | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/stories/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return unwrapData<StoryMeta>(await res.json());
  } catch {
    return null;
  }
}

const chapterNumberFromSlug = (input: string) => {
  const match = input.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
};

type Props = { params: Promise<{ slug: string; chapterSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations("StoryPage");
  const locale = await getLocale();
  const { slug, chapterSlug } = await params;
  const story = await fetchStoryMeta(slug);
  if (!story) return { title: t("notFound") };

  const storyTitle = localizedValue(locale, story.titleVi, story.titleEn, story.title);

  const chapterNum = chapterNumberFromSlug(chapterSlug);
  const chapter = chapterNum
    ? story.chapters?.find((c) => c.chapterNumber === chapterNum)
    : story.chapters?.[0];
  const chapterTitleValue = chapter
    ? localizedValue(locale, chapter.titleVi, chapter.titleEn, chapter.title)
    : "";
  const chapterDescription = chapter
    ? localizedValue(locale, chapter.descriptionVi, chapter.descriptionEn, chapter.description || "")
    : "";

  const chapterTitle = chapter
    ? t("chapterTitle", { number: chapter.chapterNumber, title: cleanChapterTitle(chapterTitleValue) })
    : t("chapterLoading");
  const title = `${chapterTitle} – ${storyTitle}`;
  const description =
    chapterDescription ||
    t("chapterFallbackDescription", { chapterTitle, title: storyTitle });
  const imageUrl = story.thumbnailUrl ?? `${SITE_URL}/og-default.jpg`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${SITE_URL}/story/${story.slug}/${chapterSlug}`,
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function StoryChapterPage({ params }: Props) {
  const t = await getTranslations("StoryPage");
  const locale = await getLocale();
  const { slug, chapterSlug } = await params;
  const story = await fetchStoryMeta(slug);
  const storyTitle = story ? localizedValue(locale, story.titleVi, story.titleEn, story.title) : "";
  const chapterNum = chapterNumberFromSlug(chapterSlug);
  const chapter = chapterNum
    ? story?.chapters?.find((c) => c.chapterNumber === chapterNum)
    : story?.chapters?.[0];
  const chapterTitleValue = chapter
    ? localizedValue(locale, chapter.titleVi, chapter.titleEn, chapter.title)
    : chapterSlug;
  const chapterLabel = chapter
    ? t("chapterTitle", { number: chapter.chapterNumber, title: cleanChapterTitle(chapterTitleValue) })
    : chapterSlug;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("home"), item: SITE_URL },
      ...(story
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: storyTitle,
              item: `${SITE_URL}/story/${story.slug}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: chapterSlug,
              item: `${SITE_URL}/story/${story.slug}/${chapterSlug}`,
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <Breadcrumbs
        lang={locale === "en" ? "en" : "vi"}
        items={story
          ? [
              { label: storyTitle, href: `/story/${story.slug}` },
              { label: chapterLabel },
            ]
          : []}
      />
      <StoryChapterClient />
    </>
  );
}
