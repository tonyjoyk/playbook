// Deterministic seeded random. Same seed -> same sequence, always.

// mulberry32: tiny, fast, good-enough PRNG.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic string/number -> 32-bit int hash, for deriving sub-seeds
// so adding an element doesn't shift everyone else's randomness.
export function hashSeed(seed, label) {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  const s = String(label);
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

// Convenience wrapper around a PRNG with common helpers.
export function makeRng(seed, label = "") {
  const rand = mulberry32(label ? hashSeed(seed, label) : seed >>> 0);
  return {
    next: rand,
    float: (min, max) => min + (max - min) * rand(),
    int: (min, max) => Math.floor(min + (max - min + 1) * rand()),
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
    chance: (p) => rand() < p,
    sign: () => (rand() < 0.5 ? -1 : 1),
  };
}
