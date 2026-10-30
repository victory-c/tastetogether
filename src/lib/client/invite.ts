import type { Interest, InterestKind, Person } from "../taste/types";

type Packed = { n: string; i: [string, string, InterestKind, number?][] };

function toBase64Url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Packs only a display name and the chosen favorites (no history) into a shareable token. */
export function encodePerson(p: Person): string {
  const packed: Packed = {
    n: p.name.slice(0, 24),
    i: p.interests.slice(0, 8).map((x) => (x.year ? [x.id, x.name, x.kind, x.year] : [x.id, x.name, x.kind])),
  };
  return toBase64Url(JSON.stringify(packed));
}

export function decodePerson(token: string): Person | null {
  try {
    const packed = JSON.parse(fromBase64Url(token)) as Packed;
    if (!packed || typeof packed.n !== "string" || !Array.isArray(packed.i)) return null;
    const interests: Interest[] = packed.i
      .filter((x) => Array.isArray(x) && /^[0-9A-Fa-f-]{36}$/.test(x[0]))
      .slice(0, 8)
      .map(([id, name, kind, year]) => ({ id, name: String(name).slice(0, 120), kind, year }));
    return { name: packed.n.slice(0, 24) || "Friend", interests };
  } catch {
    return null;
  }
}
