"use client";

import { Share2 } from "lucide-react";

import { useShareAction } from "@/hooks/use-share-action";

type ShareActionButtonProps = {
  title?: string;
  text?: string;
  url?: string;
  fallbackPrompt?: string;
  label?: string;
  className?: string;
  iconClassName?: string;
  onAfterShare?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
};

export default function ShareActionButton({
  title,
  text,
  url,
  fallbackPrompt,
  label,
  className = "",
  iconClassName = "h-4 w-4",
  onAfterShare,
  disabled = false,
  ariaLabel,
}: ShareActionButtonProps) {
  const share = useShareAction();

  return (
    <button
      type="button"
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled) return;

        await share({
          title,
          text,
          url,
          fallbackPrompt,
        });

        onAfterShare?.();
      }}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel || label || "Share"}
    >
      <Share2 className={iconClassName} />
      {label ? <span>{label}</span> : null}
    </button>
  );
}
