import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { AUDIO_STORAGE_KEY } from "@/constants/auth";

type AudioStorage = {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
};

const createNoopStorage = (): AudioStorage => ({
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
});

const getStorage = (): StateStorage =>
  typeof window === "undefined" ? createNoopStorage() : window.localStorage;

export type AudioTrack = {
  id: string;
  storyId?: string;
  chapterId?: string;
  title: string;
  storySlug?: string;
  chapterNumber?: number;
  author?: string;
  audioUrl: string;
  coverUrl?: string;
};

type AudioState = {
  queue: AudioTrack[];
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  playbackRate: number;
  isMuted: boolean;
  seekTarget: number | null;
  setQueue: (queue: AudioTrack[]) => void;
  setTrack: (track: AudioTrack | null) => void;
  playTrack: (track: AudioTrack, queue?: AudioTrack[]) => void;
  playNext: () => void;
  playPrev: () => void;
  togglePlay: (isPlaying?: boolean) => void;
  seekTo: (seconds: number) => void;
  clearSeekTarget: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (currentTime: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (playbackRate: number) => void;
  toggleMute: (isMuted?: boolean) => void;
  resetPlayer: () => void;
};

const initialState = {
  queue: [],
  currentTrack: null,
  isPlaying: false,
  volume: 1,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  isMuted: false,
  seekTarget: null,
};

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setQueue: (queue) => set({ queue }),
      setTrack: (currentTrack) =>
        set({
          currentTrack,
          currentTime: 0,
          duration: 0,
          seekTarget: null,
        }),
      playTrack: (track, queue) =>
        set((state) => ({
          queue: queue ?? state.queue,
          currentTrack: track,
          isPlaying: true,
          currentTime: 0,
          duration: 0,
          seekTarget: null,
        })),
      playNext: () => {
        const { queue, currentTrack } = get();
        if (!queue.length || !currentTrack) {
          set({ isPlaying: false });
          return;
        }

        const currentIndex = queue.findIndex((track) => track.id === currentTrack.id);
        if (currentIndex < 0 || currentIndex >= queue.length - 1) {
          set({ isPlaying: false });
          return;
        }

        const nextTrack = queue[currentIndex + 1];
        if (!nextTrack) {
          set({ isPlaying: false });
          return;
        }

        set({
          currentTrack: nextTrack,
          isPlaying: true,
          currentTime: 0,
          duration: 0,
          seekTarget: null,
        });
      },
      playPrev: () => {
        const { queue, currentTrack } = get();
        if (!queue.length || !currentTrack) {
          return;
        }

        const currentIndex = queue.findIndex((track) => track.id === currentTrack.id);
        if (currentIndex <= 0) {
          return;
        }

        const prevTrack = queue[currentIndex - 1];
        if (!prevTrack) {
          return;
        }

        set({
          currentTrack: prevTrack,
          isPlaying: true,
          currentTime: 0,
          duration: 0,
          seekTarget: null,
        });
      },
      togglePlay: (isPlaying) =>
        set((state) => ({ isPlaying: isPlaying ?? !state.isPlaying })),
      seekTo: (seconds) =>
        set((state) => {
          const maxDuration = state.duration > 0 ? state.duration : seconds;
          const next = Math.max(0, Math.min(seconds, maxDuration));
          return {
            currentTime: next,
            seekTarget: next,
          };
        }),
      clearSeekTarget: () => set({ seekTarget: null }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setCurrentTime: (currentTime) => set({ currentTime }),
      setDuration: (duration) => set({ duration }),
      setPlaybackRate: (playbackRate) => set({ playbackRate }),
      toggleMute: (isMuted) => set((state) => ({ isMuted: isMuted ?? !state.isMuted })),
      resetPlayer: () => set(initialState),
    }),
    {
      name: AUDIO_STORAGE_KEY,
      storage: createJSONStorage(getStorage),
      partialize: (state) => ({
        queue: state.queue,
        currentTrack: state.currentTrack,
        volume: state.volume,
        playbackRate: state.playbackRate,
        isMuted: state.isMuted,
      }),
    },
  ),
);
