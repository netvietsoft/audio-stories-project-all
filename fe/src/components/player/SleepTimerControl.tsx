"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";

type SleepTimerControlProps = {
  disabled?: boolean;
  onSleepTriggered: () => void;
  buttonClassName?: string;
  label?: string;
};

export default function SleepTimerControl({
  disabled = false,
  onSleepTriggered,
  buttonClassName = "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-[#3a3b3c] dark:bg-[#2f3133] dark:text-gray-200 dark:hover:bg-[#3a3b3c]",
  label = "Timer",
}: SleepTimerControlProps) {
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepMenuRef = useRef<HTMLDivElement | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  const setTimer = useCallback(
    (minutes: number | null) => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }

      if (!minutes) {
        setMinutesLeft(null);
        setShowMenu(false);
        return;
      }

      setMinutesLeft(minutes);
      sleepTimerRef.current = setTimeout(() => {
        onSleepTriggered();
        setMinutesLeft(null);
        sleepTimerRef.current = null;
      }, minutes * 60_000);
      setShowMenu(false);
    },
    [onSleepTriggered],
  );

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!minutesLeft) return;

    const timer = setInterval(() => {
      setMinutesLeft((prev) => {
        if (!prev) return null;
        if (prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 60_000);

    return () => clearInterval(timer);
  }, [minutesLeft]);

  useEffect(() => {
    if (!showMenu) return;

    const onOutside = (event: MouseEvent) => {
      if (sleepMenuRef.current && !sleepMenuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [showMenu]);

  return (
    <div className="relative" ref={sleepMenuRef}>
      <button
        type="button"
        onClick={() => setShowMenu((prev) => !prev)}
        disabled={disabled}
        className={`${buttonClassName} disabled:cursor-not-allowed disabled:opacity-40`}
        title={label}
        aria-label={label}
      >
        <Timer className="h-3.5 w-3.5" />
        <span>{minutesLeft ? `${minutesLeft}m` : label}</span>
      </button>

      {showMenu && !disabled ? (
        <div className="absolute bottom-10 left-1/2 z-50 min-w-[120px] -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-[#303133] dark:bg-[#242526]">
          <div className="flex flex-col gap-1">
            {[15, 30, 60].map((minute) => (
              <button
                key={minute}
                onClick={() => setTimer(minute)}
                className="rounded-md px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#3a3b3c]"
              >
                {minute}m
              </button>
            ))}
            <button
              onClick={() => setTimer(null)}
              className="rounded-md px-2 py-1 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
