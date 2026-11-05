/** Usporedba teksta bez obzira na velika slova i dijakritike (č, ć, š, ž, đ). */
export function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bodovanje: sve riječi upita moraju se pojaviti; početak riječi vrijedi više. */
export function matchScore(haystack: string, query: string): number {
  const h = norm(haystack);
  const words = norm(query).split(" ").filter(Boolean);
  if (!words.length) return 0;
  let score = 0;
  for (const w of words) {
    const i = h.indexOf(w);
    if (i < 0) return 0;
    score += i === 0 ? 3 : h[i - 1] === " " ? 2 : 1;
  }
  return score - h.length / 1000;
}

export const eur = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toFixed(2).replace(".", ",")} €`;

export function todayIso(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function daysBetween(aIso: string, bIso: string): number {
  return Math.round((Date.parse(bIso) - Date.parse(aIso)) / 86_400_000);
}
