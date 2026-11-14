import type { DwellDurationRange } from "../../domain";
import type { RandomStream } from "../random";

export function sampleDwellDurationSeconds(
  range: DwellDurationRange,
  tendency: number,
  stepSeconds: number,
  choice: Pick<RandomStream, "float">,
): number {
  const normalizedTendency = Math.min(1, Math.max(0, tendency - 0.5));
  const fraction = (choice.float() + normalizedTendency) / 2;
  const modeled = range.minimum + (range.maximum - range.minimum) * fraction;
  return Math.max(
    0,
    Math.ceil((modeled - Number.EPSILON) / stepSeconds) * stepSeconds,
  );
}
