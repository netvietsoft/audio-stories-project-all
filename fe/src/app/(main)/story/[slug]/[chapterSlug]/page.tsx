import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import StoryChapterClient from "./_components/StoryChapterClient";

type StoryMeta = {
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  author?: { name: string };
  chapters: Array<{
    chapterNumber: number;
    title: string;
    description?: string | null;
  }>;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://netvietaudio.com";

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

const chapterNumberFromSlug = (input: string) => {
  const match = input.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
};

type Props = { params: Promise<{ slug: string; chapterSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, chapterSlug } = await params;
  const story = await fetchStoryMeta(slug);
  if (!story) return { title: "Không tìm thấy truyện" };

  const chapterNum = chapterNumberFromSlug(chapterSlug);
  const chapter = chapterNum
    ? story.chapters?.find((c) => c.chapterNumber === chapterNum)
    : story.chapters?.[0];

  const chapterTitle = chapter
    ? `Chương ${chapter.chapterNumber}: ${chapter.title}`
    : "Đang tải chương";
  
  const title = `${chapterTitle} – ${story.title}`;
  const description =
    chapter?.description ||
    `Nghe ${chapterTitle} của truyện ${story.title} miễn phí tại Netviet Audio.`;
  const imageUrl = story.thumbnailUrl ?? `${SITE_URL}/og-image.png`;

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
  const { slug, chapterSlug } = await params;
  const story = await fetchStoryMeta(slug);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trang chủ", item: SITE_URL },
      ...(story
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: story.title,
              item: `${SITE_URL}/story/${story.slug}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: `Chương ${chapterNumberFromSlug(chapterSlug) || chapterSlug}`,
              item: `${SITE_URL}/story/${story.slug}/${chapterSlug}`,
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <StoryChapterClient />
    </>
  );
}
