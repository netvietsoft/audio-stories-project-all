import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { JsonLd } from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/Breadcrumbs";
import StoryDetailClient from "./_components/StoryDetailClient";

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
    return res.json() as Promise<StoryMeta>;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations("StoryPage");
  const locale = await getLocale();
  const { slug } = await params;
  const story = await fetchStoryMeta(slug);
  if (!story) return { title: t("notFound") };

  const storyTitle = localizedValue(locale, story.titleVi, story.titleEn, story.title);
  const storyDescription = localizedValue(locale, story.descriptionVi, story.descriptionEn, story.description);

  const title = `${storyTitle} – ${t("audioSuffix")}`;
  const description = storyDescription
    ? storyDescription.slice(0, 160)
    : t("fallbackDescription", { title: storyTitle });
  const imageUrl = story.thumbnailUrl ?? `${SITE_URL}/og-default.jpg`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE_URL}/story/${story.slug}`,
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

export default async function StoryPage({ params }: Props) {
  const t = await getTranslations("StoryPage");
  const locale = await getLocale();
  const { slug } = await params;
  const story = await fetchStoryMeta(slug);
  const storyTitle = story ? localizedValue(locale, story.titleVi, story.titleEn, story.title) : "";
  const storyDescription = story ? localizedValue(locale, story.descriptionVi, story.descriptionEn, story.description) : "";

  const audiobookSchema = story
    ? {
        "@context": "https://schema.org",
        "@type": "Audiobook",
        name: storyTitle,
        ...(story.author?.name && {
          author: { "@type": "Person", name: story.author.name },
        }),
        ...(story.thumbnailUrl && { image: story.thumbnailUrl }),
        ...(storyDescription && { description: storyDescription }),
        url: `${SITE_URL}/story/${story.slug}`,
      }
    : null;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("home"), item: SITE_URL },
      { "@type": "ListItem", position: 2, name: t("explore"), item: `${SITE_URL}/explore` },
      ...(story
        ? [{ "@type": "ListItem", position: 3, name: storyTitle, item: `${SITE_URL}/story/${story.slug}` }]
        : []),
    ],
  };

  return (
    <>
      {audiobookSchema ? <JsonLd data={audiobookSchema} /> : null}
      <JsonLd data={breadcrumbSchema} />
      <Breadcrumbs
        lang={locale === "en" ? "en" : "vi"}
        items={story ? [{ label: storyTitle }] : []}
      />
      <StoryDetailClient />
    </>
  );
}
