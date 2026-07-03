"use client";

import React from "react";
import { useParams } from "next/navigation";

import { ChapterEditor } from "../../_components/ChapterEditor";

export default function StoryChapterEditPage() {
  const params = useParams<{ lang: string; id: string; chapterId: string }>();
  const currentLang = params?.lang || "vi";
  const storyId = params?.id;
  const chapterId = params?.chapterId;

  return (
    <ChapterEditor
      chapterId={chapterId}
      lang={currentLang}
      backHref={`/${currentLang}/stories/${storyId}`}
    />
  );
}
