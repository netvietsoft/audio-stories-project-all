export type RepeatMode = "off" | "all" | "one";

export const cycleRepeatMode = (mode: RepeatMode): RepeatMode => {
  if (mode === "off") return "all";
  if (mode === "all") return "one";
  return "off";
};

const getRandomIndex = (queueLength: number, currentIndex: number) => {
  if (queueLength <= 1) return currentIndex;

  let nextIndex = currentIndex;
  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * queueLength);
  }

  return nextIndex;
};

export const resolveNextTrackIndex = (
  queueLength: number,
  currentIndex: number,
  repeatMode: RepeatMode,
  isShuffle: boolean,
): number => {
  if (queueLength <= 0) return -1;
  if (currentIndex < 0) return 0;

  if (repeatMode === "one") {
    return currentIndex;
  }

  if (isShuffle) {
    return getRandomIndex(queueLength, currentIndex);
  }

  if (currentIndex < queueLength - 1) {
    return currentIndex + 1;
  }

  if (repeatMode === "all") {
    return 0;
  }

  return -1;
};

export const resolvePrevTrackIndex = (
  queueLength: number,
  currentIndex: number,
  repeatMode: RepeatMode,
  isShuffle: boolean,
): number => {
  if (queueLength <= 0) return -1;
  if (currentIndex < 0) return 0;

  if (isShuffle) {
    return getRandomIndex(queueLength, currentIndex);
  }

  if (currentIndex > 0) {
    return currentIndex - 1;
  }

  if (repeatMode === "all") {
    return queueLength - 1;
  }

  return 0;
};
