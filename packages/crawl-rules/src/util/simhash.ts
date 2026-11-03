// 64-bit SimHash over word 3-shingles, hashed with FNV-1a 64.
//
// BigInt CONSTRUCTOR CALLS, NOT LITERALS: the app's root tsconfig targets
// ES2017, where `0n` is a compile error. BigInt() itself is fine.
//
// The result is SIGNED (BigInt.asIntN(64)) because it is stored in a Postgres
// bigint; Hamming distance is computed on the unsigned bit pattern either way.

const FNV_OFFSET = BigInt("0xcbf29ce484222325");
const FNV_PRIME = BigInt("0x100000001b3");
const ZERO = BigInt(0);
const ONE = BigInt(1);

function fnv1a64(text: string): bigint {
  let h = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i));
    h = BigInt.asUintN(64, h * FNV_PRIME);
  }
  return h;
}

/** Near-duplicate threshold: pages within this many differing bits. */
export const NEAR_DUPLICATE_MAX_HAMMING = 3;

export function simhash64(text: string): bigint {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const weights = new Array<number>(64).fill(0);
  const shingles = words.length < 3 ? [words.join(" ")] : [];
  for (let i = 0; i + 3 <= words.length; i++) shingles.push(words.slice(i, i + 3).join(" "));

  for (const s of shingles) {
    const h = fnv1a64(s);
    for (let bit = 0; bit < 64; bit++) {
      weights[bit]! += (h >> BigInt(bit)) & ONE ? 1 : -1;
    }
  }

  let out = ZERO;
  for (let bit = 0; bit < 64; bit++) {
    if (weights[bit]! > 0) out |= ONE << BigInt(bit);
  }
  return BigInt.asIntN(64, out);
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = BigInt.asUintN(64, a ^ b);
  let n = 0;
  while (x > ZERO) {
    x &= x - ONE;
    n++;
  }
  return n;
}
