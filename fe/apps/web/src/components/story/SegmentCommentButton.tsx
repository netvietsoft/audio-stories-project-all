import { MessageSquare } from "lucide-react";

type SegmentCommentButtonProps = {
  lang: string;
  paragraphId: number;
  count: number;
  onClick: () => void;
  inline?: boolean;
};

export default function SegmentCommentButton({
  lang,
  paragraphId,
  count,
  onClick,
  inline = false,
}: SegmentCommentButtonProps) {
  const label =
    lang === "en"
      ? `Comment paragraph ${paragraphId + 1}`
      : `Binh luan doan ${paragraphId + 1}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        inline
          ? "relative inline-flex h-6 w-6 shrink-0 translate-y-[1px] items-center justify-center rounded-full border border-pink-300 bg-pink-50/90 text-slate-600 transition-colors hover:bg-pink-100 dark:border-pink-800/70 dark:bg-pink-950/30 dark:text-slate-300 dark:hover:bg-pink-900/50"
          : "relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-pink-300 bg-white text-slate-600 transition-colors hover:bg-pink-50 dark:border-pink-800/70 dark:bg-gray-900 dark:text-slate-300 dark:hover:bg-pink-950/40"
      }
      aria-label={label}
      title={label}
    >
      <MessageSquare className={inline ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-pink-600 px-1 text-[10px] font-semibold leading-4 text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}
