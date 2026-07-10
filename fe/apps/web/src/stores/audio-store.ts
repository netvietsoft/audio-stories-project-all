import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { AUDIO_STORAGE_KEY } from "@/constants/auth";
import {
  cycleRepeatMode,
  resolveNextTrackIndex,
  resolvePrevTrackIndex,
  type RepeatMode,
} from "@/lib/player/playback-modes";

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
  storyCoverUrl?: string;
};

type AudioState = {
  queue: AudioTrack[];
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  bufferedTime: number;
  playbackRate: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  queuedNextMap: Record<string, string[]>;
  seekTarget: number | null;
  setQueue: (queue: AudioTrack[]) => void;
  setTrack: (track: AudioTrack | null) => void;
  playTrack: (
    track: AudioTrack,
    arg2?: number | AudioTrack[],
    arg3?: number | AudioTrack[],
    arg4?: number | AudioTrack[],
  ) => void;
  playNext: () => void;
  playPrev: () => void;
  enqueueNext: (track: AudioTrack) => void;
  enqueueManyNext: (tracks: AudioTrack[]) => void;
  toggleQueuedNext: (targetId: string, tracks: AudioTrack[]) => void;
  consumeQueuedTrack: (trackId: string) => void;
  toggleShuffle: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  cycleRepeatMode: () => void;
  togglePlay: (isPlaying?: boolean) => void;
  seekTo: (seconds: number) => void;
  clearSeekTarget: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (currentTime: number) => void;
  setDuration: (duration: number) => void;
  setBufferedTime: (bufferedTime: number) => void;
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
  bufferedTime: 0,
  playbackRate: 1,
  isMuted: false,
  isShuffle: false,
  repeatMode: "off" as RepeatMode,
  queuedNextMap: {},
  seekTarget: null,
};

const insertTracksNext = (queue: AudioTrack[], currentTrack: AudioTrack | null, tracks: AudioTrack[]) => {
  if (!tracks.length) return queue;

  const dedupedTracks = Array.from(new Map(tracks.map((track) => [track.id, track])).values());
  const dedupedIds = new Set(dedupedTracks.map((track) => track.id));
  const queueWithoutDuplicates = queue.filter((track) => !dedupedIds.has(track.id));

  if (!currentTrack) {
    return [...queueWithoutDuplicates, ...dedupedTracks];
  }

  const currentIndex = queueWithoutDuplicates.findIndex((track) => track.id === currentTrack.id);
  if (currentIndex < 0) {
    return [...queueWithoutDuplicates, ...dedupedTracks];
  }

  return [
    ...queueWithoutDuplicates.slice(0, currentIndex + 1),
    ...dedupedTracks,
    ...queueWithoutDuplicates.slice(currentIndex + 1),
  ];
};

const consumeQueuedTrackMap = (queuedNextMap: Record<string, string[]>, trackId: string) => {
  let changed = false;
  const nextMap: Record<string, string[]> = {};

  Object.entries(queuedNextMap).forEach(([targetId, pendingTrackIds]) => {
    if (!pendingTrackIds.includes(trackId)) {
      nextMap[targetId] = pendingTrackIds;
      return;
    }

    changed = true;
    const remaining = pendingTrackIds.filter((id) => id !== trackId);
    if (remaining.length) {
      nextMap[targetId] = remaining;
    }
  });

  return {
    changed,
    nextMap,
  };
};

const normalizeStartTime = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, value);
};

const normalizeDuration = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, value);
};

const resolvePlayTrackArgs = (
  arg2?: number | AudioTrack[],
  arg3?: number | AudioTrack[],
  arg4?: number | AudioTrack[],
): { queue: AudioTrack[] | undefined; startTime: number | null; totalDuration: number | null } => {
  let queue: AudioTrack[] | undefined;
  let startTime: number | null = null;
  let totalDuration: number | null = null;

  if (Array.isArray(arg2)) {
    queue = arg2;
    if (typeof arg3 === "number") {
      startTime = normalizeStartTime(arg3);
    }
    if (typeof arg4 === "number") {
      totalDuration = normalizeDuration(arg4);
    }
    return { queue, startTime, totalDuration };
  }

  if (typeof arg2 === "number") {
    startTime = normalizeStartTime(arg2);

    if (typeof arg3 === "number") {
      totalDuration = normalizeDuration(arg3);
      if (Array.isArray(arg4)) {
        queue = arg4;
      }
      return { queue, startTime, totalDuration };
    }

    if (Array.isArray(arg3)) {
      queue = arg3;
      if (typeof arg4 === "number") {
        totalDuration = normalizeDuration(arg4);
      }
    }
    return { queue, startTime, totalDuration };
  }

  if (Array.isArray(arg3)) {
    queue = arg3;
  }

  if (typeof arg3 === "number") {
    startTime = normalizeStartTime(arg3);
  }

  if (typeof arg4 === "number") {
    totalDuration = normalizeDuration(arg4);
  }

  return { queue, startTime, totalDuration };
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
      playTrack: (track, arg2, arg3, arg4) =>
        set(() => {
          const { queue, startTime, totalDuration } = resolvePlayTrackArgs(arg2, arg3, arg4);

          return {
            queue: queue ?? [track],
            currentTrack: track,
            isPlaying: true,
            currentTime: startTime ?? 0,
            duration: totalDuration ?? 0,
            seekTarget: startTime,
          };
        }),
      playNext: () => {
        const { queue, currentTrack } = get();
        if (!queue.length || !currentTrack) {
          set({
            isPlaying: false,
            currentTime: 0,
            seekTarget: 0,
          });
          return;
        }

        const currentIndex = queue.findIndex((track) => track.id === currentTrack.id);
        if (currentIndex < 0) {
          set({
            isPlaying: false,
            currentTime: 0,
            seekTarget: 0,
          });
          return;
        }

        const nextIndex = resolveNextTrackIndex(queue.length, currentIndex, get().repeatMode, get().isShuffle);

        if (nextIndex < 0 || nextIndex >= queue.length) {
          set({
            isPlaying: false,
            currentTime: 0,
            seekTarget: 0,
          });
          return;
        }

        const nextTrack = queue[nextIndex];
        if (!nextTrack) {
          set({
            isPlaying: false,
            currentTime: 0,
            seekTarget: 0,
          });
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
        const prevIndex = resolvePrevTrackIndex(queue.length, currentIndex, get().repeatMode, get().isShuffle);

        const prevTrack = queue[prevIndex];
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
      enqueueNext: (track) =>
        set((state) => ({
          queue: insertTracksNext(state.queue, state.currentTrack, [track]),
        })),
      enqueueManyNext: (tracks) =>
        set((state) => ({
          queue: insertTracksNext(state.queue, state.currentTrack, tracks),
        })),
      toggleQueuedNext: (targetId, tracks) =>
        set((state) => {
          const dedupedTracks = Array.from(new Map(tracks.map((track) => [track.id, track])).values());
          if (!dedupedTracks.length) return {};

          const existingPendingTrackIds = state.queuedNextMap[targetId];
          if (existingPendingTrackIds) {
            const currentId = state.currentTrack?.id;
            const protectedIds = new Set(
              Object.entries(state.queuedNextMap)
                .filter(([queuedTargetId]) => queuedTargetId !== targetId)
                .flatMap(([, pendingTrackIds]) => pendingTrackIds),
            );

            const removableIds = new Set(
              existingPendingTrackIds.filter((id) => id !== currentId && !protectedIds.has(id)),
            );

            const nextQueue = removableIds.size
              ? state.queue.filter((track) => track.id === currentId || !removableIds.has(track.id))
              : state.queue;

            const nextMap = { ...state.queuedNextMap };
            delete nextMap[targetId];

            return {
              queue: nextQueue,
              queuedNextMap: nextMap,
            };
          }

          return {
            queue: insertTracksNext(state.queue, state.currentTrack, dedupedTracks),
            queuedNextMap: {
              ...state.queuedNextMap,
              [targetId]: dedupedTracks.map((track) => track.id),
            },
          };
        }),
      consumeQueuedTrack: (trackId) =>
        set((state) => {
          const { changed, nextMap } = consumeQueuedTrackMap(state.queuedNextMap, trackId);
          if (!changed) return {};
          return {
            queuedNextMap: nextMap,
          };
        }),
      toggleShuffle: () =>
        set((state) => {
          const nextShuffle = !state.isShuffle;
          return {
            isShuffle: nextShuffle,
            repeatMode: nextShuffle ? ("off" as RepeatMode) : state.repeatMode,
          };
        }),
      setRepeatMode: (mode) =>
        set((state) => ({
          repeatMode: mode,
          isShuffle: mode !== "off" ? false : state.isShuffle,
        })),
      cycleRepeatMode: () =>
        set((state) => {
          const nextMode = cycleRepeatMode(state.repeatMode);
          return {
            repeatMode: nextMode,
            isShuffle: nextMode !== "off" ? false : state.isShuffle,
          };
        }),
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
      setBufferedTime: (bufferedTime) => set({ bufferedTime }),
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
        isShuffle: state.isShuffle,
        repeatMode: state.repeatMode,
      }),
    },
  ),
);
