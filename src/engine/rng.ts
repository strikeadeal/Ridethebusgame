/** Mulberry32 PRNG. Pure: callers thread the returned state through. */
export function next(state: number): { value: number; state: number } {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: s };
}

export function shuffle<T>(items: readonly T[], rngState: number): { items: T[]; rngState: number } {
  const out = items.slice();
  let state = rngState;
  for (let i = out.length - 1; i > 0; i--) {
    const r = next(state);
    state = r.state;
    const j = Math.floor(r.value * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { items: out, rngState: state };
}

export function randomInt(maxExclusive: number, rngState: number): { value: number; rngState: number } {
  const r = next(rngState);
  return { value: Math.floor(r.value * maxExclusive), rngState: r.state };
}
