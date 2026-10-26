# pollard-p-1-factorization

Factors large integers using the Pollard p-1 method with smooth-bound exponent accumulation. Written in pure ESM JavaScript (Node ≥ 16) with zero dependencies.

## Usage

```js
import { factor, pollardP1 } from "pollard-p-1-factorization";

// Convenience wrapper — accepts a Number or BigInt, returns the same type.
const f = factor(1009 * 1013);       // → 1009 or 1013

// Direct call — full control over the smooth bound and base.
const g = pollardP1(1000003n * 1000033n, { bound: 100000n, base: 2n });
// → 1000003n (or 1000033n)
```

Exports:

- `factor(n, options?)` — returns a non-trivial factor of `n`, or `null`. Mirrors the input type (Number in → Number out, BigInt in → BigInt out).
- `pollardP1(n, options?)` — core routine. `n` must be a BigInt. `options.bound` (default `100000n`) is the smoothness bound; `options.base` (default `2n`) is the starting base. Returns a BigInt factor or `null`.
- `isProbablePrime(n)`, `modPow(b, e, m)`, `gcd(a, b)` — exposed because they are useful and because the tests document their exact contracts.

## Why this exists

Pollard p-1 is the right tool when you suspect a composite has a factor `q` such that `q-1` is smooth (all prime factors small). It is dramatically cheaper than trial division for semiprimes in the 10^10–10^18 range and noticeably simpler to implement correctly than Pollard rho or ECM. The trade-off: it does nothing for factors whose `q-1` contains a large prime. If your input is a product of two strong primes, this library will return `null` and you should reach for something heavier.

The implementation accumulates the smooth exponent by repeated modular multiplication at each prime, reducing mod `n` at every step, rather than building the full exponent as a BigInt and doing one `modPow`. This caps intermediate sizes and is the reason the routine stays fast for bounds up to ~10^6.

## The edge you will hit

A factor is only found when `q-1` is **B-smooth** for at least one prime factor `q` of `n`. Concretely: every prime dividing `q-1` must be ≤ `bound`. If you raise the bound and the routine suddenly returns `null` instead of a factor, you have overshot — the accumulated exponent became a multiple of `q-1` for *every* factor simultaneously, so `gcd(a-1, n) == n` and the method is blind. The wrapper does not retry with a different base automatically; pass a different `base` yourself if this happens.

Negative input is normalised to its absolute value. Inputs below 4 and primes return `null`. Even inputs return `2` immediately without entering the smooth-bound loop.
