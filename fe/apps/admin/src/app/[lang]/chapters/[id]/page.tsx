"use client";

import React from "react";
import { useParams } from "next/navigation";

import { ChapterEditor } from "../../stories/[id]/chapters/_components/ChapterEditor";

export default function ChapterEditorPage() {
  const params = useParams<{ lang: string; id: string }>();
  const currentLang = params?.lang || "vi";
  const chapterId = params?.id;

  return (
    <ChapterEditor
      chapterId={chapterId}
      lang={currentLang}
      backHref={`/${currentLang}/chapters`}
    />
  );
}
