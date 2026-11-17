/**
 * Parses compact "ply:count,ply:count" string from Firestore into a numeric map.
 */
export function parseWeakPlies(raw: unknown): Record<number, number> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const ply = Number(k);
      const count = Number(v);
      if (Number.isInteger(ply) && ply >= 0 && Number.isFinite(count) && count > 0) {
        out[ply] = Math.round(count);
      }
    }
    return out;
  }
  if (typeof raw !== 'string' || !raw.trim()) return {};
  const out: Record<number, number> = {};
  for (const part of raw.split(',')) {
    const [pStr, cStr] = part.split(':');
    const ply = Number(pStr);
    const count = Number(cStr);
    if (Number.isInteger(ply) && ply >= 0 && Number.isInteger(count) && count > 0) {
      out[ply] = count;
    }
  }
  return out;
}

/**
 * Serializes a ply-mistake map to <= 200 chars matching ^[0-9:,]*$ for Firestore.
 */
export function serializeWeakPlies(map: Record<number, number>): string {
  const entries = Object.entries(map)
    .map(([k, v]) => [Number(k), Math.round(v)] as const)
    .filter(([k, v]) => Number.isInteger(k) && k >= 0 && v > 0)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);

  const parts: string[] = [];
  let len = 0;
  for (const [ply, count] of entries) {
    const token = `${ply}:${count}`;
    const nextLen = len === 0 ? token.length : len + 1 + token.length;
    if (nextLen > 200) break;
    parts.push(token);
    len = nextLen;
  }
  return parts.join(',');
}
