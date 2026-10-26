/**
 * Public entry point for pollard-p-1-factorization.
 *
 * Re-exports the factorization routine and the number-theory helpers it depends
 * on, so consumers can either call `factor(n)` for the convenience wrapper or
 * reach for `pollardP1` directly when they want control over the smooth bound
 * and base.
 */

import { pollardP1 as _pollardP1, isProbablePrime, modPow, gcd } from "./core.js";

const pollardP1 = _pollardP1;

export {
  pollardP1,
  isProbablePrime,
  modPow,
  gcd,
};

/**
 * Convenience wrapper: returns a non-trivial factor of n, or null if the
 * default bound cannot find one. Unlike `pollardP1`, this accepts a plain
 * number OR a BigInt and will return the same type it was given.
 *
 * WHY a wrapper: most callers just want "a factor" and don't want to remember
 * to pass `{ bound, base }`. The type-mirror behaviour keeps small callers from
 * having to sprinkle BigInt literals everywhere.
 */
export function factor(n, options = {}) {
  const wasNumber = typeof n === "number";
  if (wasNumber && !Number.isInteger(n)) {
    throw new TypeError("n must be an integer");
  }
  const big = BigInt(n);
  const result = pollardP1(big, options);
  if (result === null) return null;
  return wasNumber ? Number(result) : result;
}
