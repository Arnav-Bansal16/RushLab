/** Browser time drives presentation only. Hidden time must not skip the recording. */
export function startPlaybackAnimation(advance: (elapsedSeconds: number) => void) {
  let request = 0;
  let previous: number | undefined;
  const reset = () => {
    previous = undefined;
  };
  const tick = (timestamp: number) => {
    if (document.visibilityState === "hidden") {
      reset();
    } else {
      if (previous !== undefined) advance((timestamp - previous) / 1000);
      previous = timestamp;
    }
    request = requestAnimationFrame(tick);
  };
  document.addEventListener("visibilitychange", reset);
  request = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(request);
    document.removeEventListener("visibilitychange", reset);
  };
}
