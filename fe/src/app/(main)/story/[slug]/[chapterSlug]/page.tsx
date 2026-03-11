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
    `Nghe ${chapterTitle} của truyện ${story.title} miễn phí tại WebTruyen.`;
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
              name: chapterSlug,
              item: `${SITE_URL}/story/${story.slug}/${chapterSlug}`,
            },
          ]
        : []),
    ],
  };

<<<<<<< HEAD
  const onShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: story?.title || "Netviet Audio",

          text: "Nghe truyện này cùng mình nhé",
          url,
        });
        return;
      } catch {
        // ignore canceled share
      }
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert("Đã sao chép liên kết truyện");
    }
  };

  const setSleepTimer = (minutes: number | null) => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    if (!minutes) {
      setSleepMinutesLeft(null);
      return;
    }

    setSleepMinutesLeft(minutes);
    sleepTimerRef.current = setTimeout(() => {
      togglePlay(false);
      setSleepMinutesLeft(null);
    }, minutes * 60_000);
  };

  const openUnlockModal = () => {
    setUnlockError("");
    setShowTopupAction(false);
    setIsUnlockModalOpen(true);
  };

  const handleBuyVip = () => {
    if (!user) {
      router.push("/login");
      return;
    }

    if ((user.credits ?? 0) < VIP_UNLOCK_COST) {
      setUnlockError("Credits không đủ để mở VIP. Vui lòng nạp thêm credits.");
      setShowTopupAction(true);
      return;
    }

    const nextExpiry = new Date();
    nextExpiry.setDate(nextExpiry.getDate() + VIP_UNLOCK_DAYS);

    setUser({
      ...user,
      credits: (user.credits ?? 0) - VIP_UNLOCK_COST,
      vipTier: Math.max(1, user.vipTier || 0),
      vipExpirationDate: nextExpiry.toISOString(),
    });

    setUnlockError("");
    setShowTopupAction(false);
    setIsUnlockModalOpen(false);
  };

  const submitReview = async () => {
    if (!story) return;
    if (!user) {
      router.push("/login");
      return;
    }

    setIsSubmittingReview(true);
    try {
      await apiClient.post(`/stories/${story.id}/reviews`, {
        rating: myRating,
        content: reviewDraft.trim() || undefined,
      });

      await refreshRatingAndReviews(story.id);
      setReviewDraft("");
      setShowEmojiPicker(false);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const toggleReviewLike = async (reviewId: string) => {
    if (!story) return;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/story/${slug}/${chapterSlug}`)}`);
      return;
    }

    try {
      await apiClient.post(`/stories/${story.id}/reviews/${reviewId}/like`);
      await loadReviews(story.id, reviewSort, 1, false);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(`/story/${slug}/${chapterSlug}`)}`);
      }
    }
  };

  const toggleReviewHelpful = async (reviewId: string) => {
    if (!story) return;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/story/${slug}/${chapterSlug}`)}`);
      return;
    }

    try {
      await apiClient.post(`/stories/${story.id}/reviews/${reviewId}/helpful`);
      await loadReviews(story.id, reviewSort, 1, false);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(`/story/${slug}/${chapterSlug}`)}`);
      }
    }
  };

  const submitReviewReply = async (reviewId: string) => {
    if (!story) return;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/story/${slug}/${chapterSlug}`)}`);
      return;
    }

    const content = (reviewReplyDrafts[reviewId] || "").trim();
    if (!content) return;
    const selectedParentId = reviewReplyTarget[reviewId] || undefined;
    const parentId = selectedParentId && selectedParentId !== reviewId ? selectedParentId : undefined;

    try {
      await apiClient.post(`/stories/${story.id}/reviews/${reviewId}/replies`, {
        content,
        parentId,
      });

      setReviewReplyDrafts((prev) => ({ ...prev, [reviewId]: "" }));
      setReviewReplyTarget((prev) => ({ ...prev, [reviewId]: null }));
      await loadReviews(story.id, reviewSort, 1, false);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(`/story/${slug}/${chapterSlug}`)}`);
      }
    }
  };

  const loadMoreReviews = async () => {
    if (!story) return;
    if (reviewPage >= reviewLastPage) return;
    await loadReviews(story.id, reviewSort, reviewPage + 1, true);
  };

  const collapseReviews = async () => {
    if (!story) return;
    await loadReviews(story.id, reviewSort, 1, false);
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Truyện đang tải, bạn đợi xíu nhé!</p>;
  }

  if (!story || !selectedChapter) {
    return <p className="text-sm text-red-600">Không tìm thấy truyện hoặc chương.</p>;
  }

=======
>>>>>>> 8c465ef0528f9d81e28bbea6af67e61b03de2282
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <StoryChapterClient />
    </>
  );
}
