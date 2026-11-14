import { uniformFloat64 } from "pure-rand/distribution/uniformFloat64";
import { uniformInt } from "pure-rand/distribution/uniformInt";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";
import type { RandomGenerator } from "pure-rand/types/RandomGenerator";

export const RANDOM_STREAM_NAMES = [
  "arrivals",
  "profiles",
  "choice",
  "service",
  "movement",
] as const;

export type RandomStreamName = (typeof RANDOM_STREAM_NAMES)[number];

/** Small stateful adapter around pure-rand for simulation-only random draws. */
export class RandomStream {
  readonly #generator: RandomGenerator;

  constructor(seed: number) {
    this.#generator = xoroshiro128plus(seed | 0);
  }

  float(): number {
    return uniformFloat64(this.#generator);
  }

  integer(minimum: number, maximum: number): number {
    return uniformInt(this.#generator, minimum, maximum);
  }

  weightedIndex(weights: readonly number[]): number {
    const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
    if (weights.length === 0) {
      throw new Error("Cannot choose from an empty collection");
    }
    if (total === 0) {
      return this.integer(0, weights.length - 1);
    }

    const threshold = this.float() * total;
    let cumulative = 0;
    for (let index = 0; index < weights.length; index += 1) {
      cumulative += Math.max(0, weights[index] ?? 0);
      if (threshold < cumulative) {
        return index;
      }
    }
    return weights.length - 1;
  }
}

export type NamedRandomStreams = Record<RandomStreamName, RandomStream>;

function deriveSeed(runSeed: number, name: RandomStreamName): number {
  let hash = (runSeed | 0) ^ 0x811c9dc5;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

export function createNamedRandomStreams(seed: number): NamedRandomStreams {
  return Object.fromEntries(
    RANDOM_STREAM_NAMES.map((name) => [
      name,
      new RandomStream(deriveSeed(seed, name)),
    ]),
  ) as NamedRandomStreams;
}
