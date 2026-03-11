import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/JsonLd";
import StoryDetailClient from "./_components/StoryDetailClient";

type StoryMeta = {
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  author?: { name: string };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
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
  const { slug } = await params;
  const story = await fetchStoryMeta(slug);
  if (!story) return { title: "Không tìm thấy truyện" };

  const title = `${story.title} – Truyện Audio`;
  const description = story.description
    ? story.description.slice(0, 160)
    : `Nghe truyện audio ${story.title} miễn phí tại WebTruyen.`;
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
  const { slug } = await params;
  const story = await fetchStoryMeta(slug);

  const audiobookSchema = story
    ? {
        "@context": "https://schema.org",
        "@type": "Audiobook",
        name: story.title,
        ...(story.author?.name && {
          author: { "@type": "Person", name: story.author.name },
        }),
        ...(story.thumbnailUrl && { image: story.thumbnailUrl }),
        ...(story.description && { description: story.description }),
        url: `${SITE_URL}/story/${story.slug}`,
      }
    : null;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trang chủ", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Khám phá", item: `${SITE_URL}/explore` },
      ...(story
        ? [{ "@type": "ListItem", position: 3, name: story.title, item: `${SITE_URL}/story/${story.slug}` }]
        : []),
    ],
  };

  return (
    <>
      {audiobookSchema ? <JsonLd data={audiobookSchema} /> : null}
      <JsonLd data={breadcrumbSchema} />
      <StoryDetailClient />
    </>
  );
}
