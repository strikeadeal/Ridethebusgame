/** Seed from the (undocumented) ?seed= URL param — kept in all builds so E2E
 *  tests run against the production bundle — otherwise random. */
export function newSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  if (param !== null) {
    const n = Number.parseInt(param, 10);
    if (Number.isFinite(n)) return n >>> 0;
  }
  return Math.floor(Math.random() * 2 ** 31);
}
