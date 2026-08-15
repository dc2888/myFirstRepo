export const MAX_FRAME_SECONDS = 0.05;

export function frameSecondsFromDelta(deltaMs, maxFrameSeconds = MAX_FRAME_SECONDS) {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return Math.min(deltaMs / 1000, maxFrameSeconds);
}
