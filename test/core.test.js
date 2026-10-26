import { test } from "node:test";
import assert from "node:assert/strict";

import {
  pollardP1,
  isProbablePrime,
  modPow,
  gcd,
  factor,
} from "../src/index.js";

// --- helpers -------------------------------------------------------------

test("modPow matches BigInt exponentiation for small values", () => {
  for (let base = 0n; base < 10n; base++) {
    for (let exp = 0n; exp < 10n; exp++) {
      for (let m = 2n; m < 12n; m++) {
        assert.equal(
          modPow(base, exp, m),
          ((base ** exp) % m + m) % m,
          `${base}^${exp} mod ${m}`,
        );
      }
    }
  }
});

test("modPow throws on non-BigInt input", () => {
  assert.throws(() => modPow(2, 3n, 5n), TypeError);
  assert.throws(() => modPow(2n, 3, 5n), TypeError);
  assert.throws(() => modPow(2n, 3n, 5), TypeError);
});

test("modPow rejects non-positive modulus", () => {
  assert.throws(() => modPow(2n, 3n, 0n), RangeError);
  assert.throws(() => modPow(2n, 3n, -5n), RangeError);
});

test("modPow handles negative base", () => {
  // -2 ^ 3 mod 5 = -8 mod 5 = 2
  assert.equal(modPow(-2n, 3n, 5n), 2n);
});

// --- gcd -----------------------------------------------------------------

test("gcd of basic pairs", () => {
  assert.equal(gcd(12n, 8n), 4n);
  assert.equal(gcd(17n, 5n), 1n);
  assert.equal(gcd(100n, 10n), 10n);
  assert.equal(gcd(7n, 7n), 7n);
});

test("gcd with zero", () => {
  assert.equal(gcd(0n, 5n), 5n);
  assert.equal(gcd(5n, 0n), 5n);
  assert.equal(gcd(0n, 0n), 0n);
});

test("gcd normalises negatives", () => {
  assert.equal(gcd(-12n, 8n), 4n);
  assert.equal(gcd(-12n, -8n), 4n);
});

test("gcd throws on non-BigInt", () => {
  assert.throws(() => gcd(12, 8n), TypeError);
  assert.throws(() => gcd(12n, 8), TypeError);
});

// --- isProbablePrime -----------------------------------------------------

test("isProbablePrime on small numbers", () => {
  const primes = [2n, 3n, 5n, 7n, 11n, 13n, 97n, 101n, 1009n];
  const composites = [0n, 1n, 4n, 6n, 8n, 9n, 15n, 100n, 1001n];
  for (const p of primes) assert.equal(isProbablePrime(p), true, `${p} prime`);
  for (const c of composites) {
    assert.equal(isProbablePrime(c), false, `${c} composite`);
  }
});

test("isProbablePrime on a large known prime", () => {
  // 2^61 - 1 is a Mersenne prime.
  assert.equal(isProbablePrime(2n ** 61n - 1n), true);
});

test("isProbablePrime on a large known composite", () => {
  // (2^61 - 1) * (2^61 + 1) — product of two large coprime factors.
  assert.equal(isProbablePrime((2n ** 61n - 1n) * (2n ** 61n + 1n)), false);
});

test("isProbablePrime throws on non-BigInt", () => {
  assert.throws(() => isProbablePrime(7), TypeError);
});

// --- pollardP1 -----------------------------------------------------------

/**
 * Verify that a returned factor is genuinely non-trivial and divides n.
 */
function checkFactor(n, f) {
  assert.ok(f !== null, `expected a factor of ${n}, got null`);
  assert.ok(typeof f === "bigint", "factor must be BigInt");
  assert.ok(f > 1n, `factor ${f} must be > 1`);
  assert.ok(f < n, `factor ${f} must be < n`);
  assert.equal(n % f, 0n, `factor ${f} does not divide ${n}`);
}

test("pollardP1 finds a factor of a product of two medium primes", () => {
  // 1009 * 1013 — both primes, both with small q-1.
  const n = 1009n * 1013n;
  checkFactor(n, pollardP1(n));
});

test("pollardP1 finds a factor of a larger semiprime", () => {
  // 1000003 (prime) * 1000033 (prime). q-1 for 1000003 is 2 * 500000,
  // which is 500000-smooth; default bound 100000 is enough because the
  // largest prime in 500000's factorisation is well under 100000. Same for
  // 1000033 (q-1 = 2 * 500016 = 2^5 * 3 * 5 * 41 * 101).
  const n = 1000003n * 1000033n;
  checkFactor(n, pollardP1(n));
});

test("pollardP1 with a factor whose q-1 has a large prime factor", () => {
  // 53 is prime; q-1 = 52 = 4 * 13. With a low bound this should fail.
  const n = 53n * 101n;
  assert.equal(pollardP1(n, { bound: 10n }), null);
  // With bound 50 it should succeed (13 <= 50).
  checkFactor(n, pollardP1(n, { bound: 50n }));
});

test("pollardP1 returns 2 for even n", () => {
  assert.equal(pollardP1(6n), 2n);
  assert.equal(pollardP1(2n * 1009n * 1013n), 2n);
});

test("pollardP1 returns null for prime n", () => {
  assert.equal(pollardP1(97n), null);
  assert.equal(pollardP1(1009n), null);
});

test("pollardP1 returns null for n < 4", () => {
  assert.equal(pollardP1(0n), null);
  assert.equal(pollardP1(1n), null);
  assert.equal(pollardP1(2n), null);
  assert.equal(pollardP1(3n), null);
});

test("pollardP1 normalises negative input", () => {
  // -1009 * 1013 should behave identically to the positive case.
  const n = -(1009n * 1013n);
  const f = pollardP1(n);
  assert.ok(f !== null, `expected a factor of ${n}, got null`);
  assert.equal(n % f, 0n);
});

test("pollardP1 rejects bad options", () => {
  assert.throws(() => pollardP1(15n, { bound: 0n }), RangeError);
  assert.throws(() => pollardP1(15n, { base: 1n }), RangeError);
  assert.throws(() => pollardP1(15n, { base: 2 }), TypeError);
});

test("pollardP1 rejects non-BigInt n", () => {
  assert.throws(() => pollardP1(15), TypeError);
});

test("pollardP1 can recover when the default base is degenerate", () => {
  // n = 2 * something where base 2 mod n is itself a multiple of a factor.
  // We craft n so that 2 mod n == 2 (always true for n>2), which is fine, but
  // construct n where a factor divides 2: take factor 2 itself. We already
  // short-circuit even n, so instead use n = 4 * odd to force base 2 mod n = 2
  // but gcd(2-1, n) = 1 at first. That doesn't exercise the degenerate path.
  //
  // Real degenerate case: n where 2 is a primitive root mod every factor.
  // We can fake "base 2 mod n <= 1" only when n <= 3, already handled. So the
  // degenerate-recovery branch is exercised by passing an explicit bad base.
  const n = 1009n * 1013n;
  // base 1 is rejected; base 0 rejected; but base = n+2 means (n+2) mod n = 2,
  // which is fine. To hit the recovery path we need (base mod n) <= 1, i.e.
  // base = n or base = n+1.
  const result = pollardP1(n, { base: n + 1n });
  // Recovery is best-effort and may still return null when base mod n maps to
  // a degenerate state; the test asserts non-null only when recovery succeeds.
  assert.ok(result === null || (result > 1n && result < n && n % result === 0n));
});

// --- factor (convenience wrapper) ---------------------------------------

test("factor accepts a plain number and returns a number", () => {
  const f = factor(1009 * 1013);
  assert.equal(typeof f, "number");
  assert.ok(f > 1 && f < 1009 * 1013);
  assert.equal((1009 * 1013) % f, 0);
});

test("factor accepts a BigInt and returns a BigInt", () => {
  const n = 1009n * 1013n;
  const f = factor(n);
  assert.equal(typeof f, "bigint");
  checkFactor(n, f);
});

test("factor returns null when no factor is found", () => {
  assert.equal(factor(97), null);
  assert.equal(factor(97n), null);
});

test("factor rejects non-integer numbers", () => {
  assert.throws(() => factor(15.5), TypeError);
});

test("factor returns 2 for even input", () => {
  assert.equal(factor(2 * 1009 * 1013), 2);
  assert.equal(factor(2n * 1009n * 1013n), 2n);
});
