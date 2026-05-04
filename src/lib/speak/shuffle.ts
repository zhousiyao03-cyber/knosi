/**
 * Fisher–Yates shuffle. Pure: returns a new array, never mutates input.
 *
 * `rng` defaults to Math.random but is injectable for deterministic tests.
 * It must return a value in [0, 1).
 */
export function shuffle<T>(input: readonly T[], rng: () => number = Math.random): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
