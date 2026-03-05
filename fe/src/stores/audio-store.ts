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
  title: string;
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
  setQueue: (queue: AudioTrack[]) => void;
  setTrack: (track: AudioTrack | null) => void;
  togglePlay: (isPlaying?: boolean) => void;
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
};

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      ...initialState,
      setQueue: (queue) => set({ queue }),
      setTrack: (currentTrack) => set({ currentTrack }),
      togglePlay: (isPlaying) =>
        set((state) => ({ isPlaying: isPlaying ?? !state.isPlaying })),
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
