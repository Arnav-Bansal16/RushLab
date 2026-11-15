import type {
  AttendeeIntent,
  Festival,
  IntentWeights,
  Point,
} from "../../domain";
import { RandomStream } from "../random";

function stableHash(seed: number, key: string): number {
  let hash = (seed | 0) ^ 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

export function createAttendeeChoiceStream(
  seed: number,
  choiceStreamKey: string,
): RandomStream {
  return new RandomStream(stableHash(seed, choiceStreamKey));
}

const INTENTS: AttendeeIntent[] = [
  "stage_first",
  "vendor_first",
  "explorer",
  "amenity_first",
];

export function assignStableIntent(
  seed: number,
  choiceStreamKey: string,
  weights: IntentWeights,
): AttendeeIntent {
  const intent = createAttendeeChoiceStream(seed, `${choiceStreamKey}:intent`);
  return INTENTS[intent.weightedIndex(INTENTS.map((name) => weights[name]))]!;
}

export function generateRoamingWaypoints(
  festival: Festival,
  count: number,
  choice: Pick<RandomStream, "float">,
): Point[] {
  return Array.from({ length: count }, () => ({
    x: choice.float() * festival.boundsMeters.width,
    y: choice.float() * festival.boundsMeters.height,
  }));
}
