// Proof of work for cost-bearing OTP requests (G5, docs/YARIZAN-G5-ANTI-ABUSE.md). The Backend
// issues a challenge bound to purpose, mobile and expiry; the browser finds a counter so that
// SHA-256(challenge + ":" + counter) starts with `bits` zero bits. It is friction against bulk SMS
// abuse, never the only control. A synchronous SHA-256 keeps the Worker loop fast and dependency-free.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const W = new Uint32Array(64);
const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

export function sha256(bytes: Uint8Array): Uint8Array {
  const length = bytes.length,
    total = Math.ceil((length + 9) / 64) * 64,
    m = new Uint8Array(total);
  m.set(bytes);
  m[length] = 0x80;
  const bits = length * 8;
  m[total - 4] = bits >>> 24;
  m[total - 3] = bits >>> 16;
  m[total - 2] = bits >>> 8;
  m[total - 1] = bits;
  m[total - 5] = Math.floor(bits / 2 ** 32);
  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a,
    h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++)
      W[i] =
        (m[o + i * 4]! << 24) |
        (m[o + i * 4 + 1]! << 16) |
        (m[o + i * 4 + 2]! << 8) |
        m[o + i * 4 + 3]!;
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15]!, 7) ^ rotr(W[i - 15]!, 18) ^ (W[i - 15]! >>> 3),
        s1 = rotr(W[i - 2]!, 17) ^ rotr(W[i - 2]!, 19) ^ (W[i - 2]! >>> 10);
      W[i] = (W[i - 16]! + s0 + W[i - 7]! + s1) | 0;
    }
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;
    for (let i = 0; i < 64; i++) {
      const t1 =
          (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i]! + W[i]!) | 0,
        t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }
  const out = new Uint8Array(32);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, i) => {
    out[i * 4] = v >>> 24;
    out[i * 4 + 1] = v >>> 16;
    out[i * 4 + 2] = v >>> 8;
    out[i * 4 + 3] = v;
  });
  return out;
}
export function leadingZeroBits(digest: Uint8Array) {
  let bits = 0;
  for (const byte of digest) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}
/** Finds the first counter that satisfies the challenge (same rule as the Backend). */
export function solvePow(challenge: string, bits: number) {
  const encoder = new TextEncoder();
  for (let counter = 0; ; counter++) {
    if (leadingZeroBits(sha256(encoder.encode(challenge + ':' + counter))) >= bits)
      return String(counter);
  }
}
