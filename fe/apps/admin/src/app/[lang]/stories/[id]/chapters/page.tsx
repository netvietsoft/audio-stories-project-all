"use client";

import StoryChapterManager from "../_components/StoryChapterManager";
import { useParams } from "next/navigation";

export default function StoryChaptersPage() {
  const params = useParams<{ id: string }>();
  
  if (!params?.id) return null;

  return (
    <div className="bg-slate-50 min-h-screen p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden h-[calc(100vh-100px)]">
        <StoryChapterManager storyId={params.id} />
      </div>
    </div>
  );
}
