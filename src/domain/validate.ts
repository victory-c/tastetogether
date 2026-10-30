// Guards on generated explanation text. LLM output may only restate structured facts.

const DISALLOWED_PATTERNS: RegExp[] = [
  /\$\s?\d/, // dollar amounts: we only know price levels
  /\b\d+\s?(?:-|–|to)?\s?\d*\s?(?:min|mins|minute|minutes)\b/i, // wait-time minutes
  /\bwait(?:ing)?\s+time\b/i,
  /\b(?:no|short|long)\s+(?:line|queue|wait)\b/i,
  /\bopen (?:then|at that time|when you arrive)\b/i,
  /\bguarantee/i,
  /[一-鿿]/, // product output must be English
];

export interface ReasonCheckInput {
  reasons: string[];
  /** The only venue names the text may mention. */
  allowedNames: string[];
  /** Other venue names that must not leak into this card (other results, history). */
  forbiddenNames: string[];
}

export function reasonsAreSafe({ reasons, allowedNames, forbiddenNames }: ReasonCheckInput): boolean {
  if (reasons.length === 0 || reasons.length > 4) return false;
  return reasons.every((r) => {
    if (r.length === 0 || r.length > 240) return false;
    if (DISALLOWED_PATTERNS.some((p) => p.test(r))) return false;
    const lower = r.toLowerCase();
    if (forbiddenNames.some((n) => n.length > 3 && !allowedNames.includes(n) && lower.includes(n.toLowerCase()))) return false;
    return true;
  });
}
