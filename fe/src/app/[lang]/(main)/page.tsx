import Link from "@/components/shared/LocalizedLink";
import { ArrowRight, BookOpenText, Headphones, Music2, Sparkles } from "lucide-react";

type LandingChoicePageProps = {
  params?: Promise<{ lang: string }>;
};

export default async function LandingChoicePage({ params }: LandingChoicePageProps) {
  const resolvedParams = params ? await params : { lang: "vi" };
  const { lang } = resolvedParams;
  const isEn = lang === "en";

  const content = {
    eyebrow: isEn ? "Choose your listening space" : "Chon khong gian thuong thuc",
    title: isEn ? "One platform, two worlds" : "Mot nen tang, hai the gioi",
    subtitle: isEn
      ? "Go to Story for serial audio narratives, or Music for playlists and tracks."
      : "Vao Story de nghe truyen dai ky, hoac vao Music de kham pha bai hat va playlist.",
    storyTitle: isEn ? "Story" : "Story",
    storyDesc: isEn
      ? "Trending stories, interactive branches, category hubs, and chapter journeys."
      : "Truyen trending, truyen tuong tac, theo the loai va hanh trinh theo tung chuong.",
    storyCta: isEn ? "Go to Story" : "Vao Story",
    musicTitle: isEn ? "Music" : "Music",
    musicDesc: isEn
      ? "US-UK, K-Pop, V-Pop, Hip Hop, trending tracks and freshly uploaded releases."
      : "US-UK, K-Pop, V-Pop, Hip Hop, nhac thinh hanh va cac bai moi dang.",
    musicCta: isEn ? "Go to Music" : "Vao Music",
  };

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-6 shadow-sm sm:p-8 lg:p-10 dark:border-[#303133] dark:from-[#23171d] dark:via-[#18181b] dark:to-[#1e1a15]">
      <div className="pointer-events-none absolute -top-20 right-0 h-64 w-64 rounded-full bg-rose-300/30 blur-3xl dark:bg-rose-900/30" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-orange-300/20 blur-3xl dark:bg-orange-900/20" />

      <div className="relative z-10 space-y-8">
        <div className="max-w-3xl space-y-3">
          <p className="inline-flex items-center gap-2 rounded-full border border-rose-300/70 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-600 dark:border-rose-700/60 dark:bg-[#1f1f22]/80 dark:text-rose-300">
            <Sparkles className="h-3.5 w-3.5" />
            {content.eyebrow}
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">{content.title}</h1>
          <p className="max-w-2xl text-sm font-medium text-slate-600 sm:text-base dark:text-zinc-300">{content.subtitle}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Link
            href="/story"
            className="group relative overflow-hidden rounded-3xl border border-rose-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-rose-900/40 dark:bg-[#1a1a1d]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-rose-50 to-transparent opacity-90 dark:from-rose-900/20" />
            <div className="relative z-10 space-y-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
                <BookOpenText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{content.storyTitle}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">{content.storyDesc}</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-rose-500">
                {content.storyCta}
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>

          <Link
            href="/music"
            className="group relative overflow-hidden rounded-3xl border border-orange-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-orange-900/40 dark:bg-[#1a1a1d]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-transparent opacity-90 dark:from-orange-900/20" />
            <div className="relative z-10 space-y-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300">
                <Music2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{content.musicTitle}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">{content.musicDesc}</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-orange-500">
                {content.musicCta}
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-500 dark:border-[#303133] dark:bg-[#202124] dark:text-zinc-400">
          <Headphones className="h-3.5 w-3.5" />
          {isEn ? "You can switch between Story and Music any time from the navbar." : "Ban co the chuyen doi giua Story va Music bat ky luc nao tu navbar."}
        </div>
      </div>
    </div>
  );
}
