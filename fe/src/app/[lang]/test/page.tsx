"use client";

import { useMemo, useState } from "react";

import YouTubePoC from "@/components/player/YouTubePoC";

const extractYoutubeId = (input: string) => {
  const value = input.trim();
  if (!value) return "";

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = value.match(regExp);

  if (match && match[7] && match[7].length === 11) {
    return match[7];
  }

  return "";
};

export default function TestYoutubePage() {
  const [inputValue, setInputValue] = useState("https://www.youtube.com/watch?v=M7lc1UVf-VE");
  const [videoId, setVideoId] = useState("M7lc1UVf-VE");
  const [error, setError] = useState("");

  const helperText = useMemo(() => {
    return "Nhập YouTube URL hoặc ID (11 ký tự), ví dụ: M7lc1UVf-VE";
  }, []);

  const loadVideo = () => {
    const nextVideoId = extractYoutubeId(inputValue);

    if (!nextVideoId) {
      setError("Không đọc được YouTube ID. Vui lòng kiểm tra lại URL/ID.");
      return;
    }

    setError("");
    setVideoId(nextVideoId);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[5px] border border-gray-300 bg-white p-4 sm:p-5 dark:border-[#303133] dark:bg-[#242526]">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">YouTube Audio Player PoC</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Test nóng khả năng điều khiển YouTube bằng custom audio controls (play/pause, tua, progress, speed, volume, sleep timer).
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                loadVideo();
              }
            }}
            placeholder="YouTube URL hoặc Video ID"
            className="h-11 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-200 dark:border-[#3a3b3c] dark:bg-[#18191a] dark:text-gray-100"
            aria-label="YouTube URL hoặc video ID"
          />

          <button
            onClick={loadVideo}
            className="h-11 shrink-0 rounded-lg bg-pink-600 px-5 text-sm font-semibold text-white transition hover:bg-pink-700"
          >
            Load Video
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
        {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          Video ID hiện tại: <span className="font-semibold text-pink-600 dark:text-pink-300">{videoId}</span>
        </p>
      </section>

      <YouTubePoC key={videoId} videoId={videoId} />
    </div>
  );
}
