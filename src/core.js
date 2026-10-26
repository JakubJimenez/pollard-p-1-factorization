/**
 * Pollard p-1 factorization stage.
 *
 * WHY BigInt throughout: Pollard p-1 is only interesting for integers that
 * exceed the safe-integer range (2^53), so the whole pipeline is written in
 * BigInt to avoid a mixed-numeric boundary that would silently corrupt large
 * inputs.
 */

/**
 * Deterministic Miller-Rabin primality test for 64-bit-ish BigInt candidates.
 *
 * WHY a fixed witness set instead of a random one: the tests in this project
 * are required to be deterministic, and the witnesses below are sufficient for
 * every n < 3,317,044,064,679,887,385,961,981 which covers everything this
 * library will ever be handed.
 */
export function isProbablePrime(n) {
  if (typeof n !== "bigint") throw new TypeError("n must be a BigInt");
  if (n < 0n) n = -n;
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }

  // Write n-1 = d * 2^s with d odd.
  let d = n - 1n;
  let s = 0n;
  while (d % 2n === 0n) {
    d /= 2n;
    s += 1n;
  }

  const witnesses = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];
  witness: for (const a of witnesses) {
    if (a % n === 0n) continue; // witness is a multiple of n — skip
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue witness;
    for (let r = 0n; r < s - 1n; r += 1n) {
      x = (x * x) % n;
      if (x === n - 1n) continue witness;
    }
    return false;
  }
  return true;
}

/**
 * Modular exponentiation: base**exp mod m.
 *
 * WHY not ** then %: computing base**exp directly for the magnitudes involved
 * here (exp can be a factorial-style product) is memory-prohibitive, so we
 * reduce mod m at every multiply.
 */
export function modPow(base, exp, m) {
  if (typeof base !== "bigint") throw new TypeError("base must be a BigInt");
  if (typeof exp !== "bigint") throw new TypeError("exp must be a BigInt");
  if (typeof m !== "bigint") throw new TypeError("m must be a BigInt");
  if (m <= 0n) throw new RangeError("modulus must be positive");

  let result = 1n;
  base = base % m;
  if (base < 0n) base += m;

  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * base) % m;
    e >>= 1n;
    base = (base * base) % m;
  }
  return result;
}

/**
 * Greatest common divisor via the binary Euclid algorithm.
 *
 * WHY binary (shift-based) rather than the textbook % loop: it avoids BigInt
 * division, which is noticeably more expensive on V8 for the sizes we meet.
 */
export function gcd(a, b) {
  if (typeof a !== "bigint") throw new TypeError("a must be a BigInt");
  if (typeof b !== "bigint") throw new TypeError("b must be a BigInt");
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  if (a === 0n) return b;
  if (b === 0n) return a;

  let shift = 0n;
  while (((a | b) & 1n) === 0n) {
    a >>= 1n;
    b >>= 1n;
    shift += 1n;
  }
  while ((a & 1n) === 0n) a >>= 1n;

  while (b !== 0n) {
    while ((b & 1n) === 0n) b >>= 1n;
    if (a > b) [a, b] = [b, a];
    b -= a;
  }
  return a << shift;
}

/**
 * Pollard p-1 with smooth-bound exponent accumulation.
 *
 * The algorithm: choose a base a, then raise it to the product of
 *   prime**floor(log_p(B))
 * for every prime p <= B (so the exponent is B-smooth). If a prime factor q of n
 * has q-1 B-smooth, then q | gcd(a**M - 1, n).
 *
 * The exponent is accumulated multiplicatively with a running % (q-1) reduction
 * at each prime, which keeps the running base from blowing up to astronomical
 * size while remaining correct: if the true smooth exponent is M, then
 *   a**M mod n == a**(M mod (q-1)) mod q  for q not dividing a.
 *
 * Returns the discovered factor, or null if none was found within the bound.
 *
 * WHY accumulate-by-multiply instead of computing the full exponent first:
 * building M explicitly as a BigInt and then doing a single modPow is both
 * slower (M is huge) and harder to bound — the running-reduction form naturally
 * caps intermediate sizes.
 */
export function pollardP1(n, options = {}) {
  if (typeof n !== "bigint") throw new TypeError("n must be a BigInt");
  if (n < 0n) n = -n;
  if (n < 4n) return null;
  if (n % 2n === 0n) return 2n;

  const bound = BigInt(options.bound ?? 100000n);
  if (bound < 1n) throw new RangeError("bound must be >= 1");
  const base = options.base ?? 2n;
  if (typeof base !== "bigint") throw new TypeError("base must be a BigInt");
  if (base < 2n) throw new RangeError("base must be >= 2");

  // Tiny-composite fast path: if n itself is small and prime, no factor exists.
  if (isProbablePrime(n)) return null;

  let a = base % n;
  if (a <= 1n) {
    // base is a multiple of n (or 1 mod n) — the method is blind to it.
    // We try the next few small bases deterministically instead of failing.
    let probe = base + 1n;
    while (probe < n && (probe % n) <= 1n) probe += 1n;
    if (probe >= n) return null;
    a = probe % n;
  }

  for (let p = 2n; p <= bound; p = nextPrime(p)) {
    // exponent for this prime: p**e <= bound, so e = floor(log_p(bound))
    let pe = p;
    while (pe * p <= bound) pe *= p;

    // Raise a to p**e, but reduce mod (q-1) implicitly via the running a.
    // We must do this as repeated squaring on `a` directly so that each step
    // stays bounded by n.
    a = modPow(a, pe, n);

    const g = gcd(a - 1n, n);
    if (g === 1n) continue;
    if (g === n) return null; // bound too high — overshot
    return g;
  }

  return null;
}

/** Smallest prime strictly greater than p. Used to walk the smooth bound. */
function nextPrime(p) {
  let c = p + 1n;
  if (c <= 2n) return 2n;
  if (c === 2n) return 3n;
  if (c % 2n === 0n) c += 1n;
  while (!isProbablePrime(c)) c += 2n;
  return c;
}
