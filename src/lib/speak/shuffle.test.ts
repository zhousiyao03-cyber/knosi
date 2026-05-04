import { describe, it, expect } from "vitest";
import { shuffle } from "./shuffle";

describe("shuffle", () => {
  it("preserves all original elements (multiset equality)", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = shuffle(input);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it("does not mutate the input array", () => {
    const input = [1, 2, 3, 4, 5];
    const snapshot = [...input];
    shuffle(input);
    expect(input).toEqual(snapshot);
  });

  it("returns a different reference from the input", () => {
    const input = [1, 2, 3];
    expect(shuffle(input)).not.toBe(input);
  });

  it("uses the supplied rng (deterministic when rng is fixed)", () => {
    const input = [1, 2, 3, 4, 5];
    // rng() === 0 means j = floor(0 * (i+1)) = 0 every step.
    // Walking Fisher-Yates from the end:
    //   [1,2,3,4,5] → swap 4↔0 → [5,2,3,4,1]
    //                → swap 3↔0 → [4,2,3,5,1]
    //                → swap 2↔0 → [3,2,4,5,1]
    //                → swap 1↔0 → [2,3,4,5,1]
    const fixedZero = () => 0;
    const out = shuffle(input, fixedZero);
    expect(out).toEqual([2, 3, 4, 5, 1]);
  });

  it("works on a single element", () => {
    expect(shuffle([42])).toEqual([42]);
  });

  it("works on an empty array", () => {
    expect(shuffle([])).toEqual([]);
  });
});
