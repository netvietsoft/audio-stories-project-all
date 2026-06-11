export const PLAYBACK_SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

export const resolveNextPlaybackRate = (
  currentRate: number,
  options: readonly number[] = PLAYBACK_SPEED_OPTIONS,
): number => {
  const currentIndex = options.findIndex((item) => item === currentRate);
  const nextIndex = currentIndex < 0 ? 1 : (currentIndex + 1) % options.length;
  return options[nextIndex] ?? 1;
};

export const clampVolume = (value: number): number => Math.max(0, Math.min(1, value));

export const clampSeekTarget = (value: number, duration: number): number => {
  const max = duration > 0 ? duration : value;
  return Math.max(0, Math.min(value, max));
};
