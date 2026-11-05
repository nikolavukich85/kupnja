import { matchScore } from "./text";

/** [redovna cijena, akcijska cijena, najniža u 30 dana, vrsta akcije?] */
export type ChainPrice = [number | null, number | null, number | null, string?];

export type Product = {
  id: string; // barkod ili "lanac:šifra"
  n: string; // naziv
  b: string; // marka
  q: string; // količina
  u: string; // jedinica
  k: string; // kategorija
  c: Record<string, ChainPrice>;
};

export type PriceData = {
  updated: string;
  date: string | null;
  chains: Record<string, { name: string; stores: number; scope: "local" | "all"; products: number }>;
  products: Product[];
};

export const EMPTY: PriceData = { updated: "", date: null, chains: {}, products: [] };

let cache: Promise<PriceData | null> | null = null;
let index: Map<string, Product> | null = null;

/** Cijene se osvježavaju jednom dnevno; preglednik ih sprema pa rade i bez interneta. */
export function loadPrices(url = "./data/prices.json"): Promise<PriceData | null> {
  cache ??= fetch(url, { cache: "no-cache" })
    .then((r) => (r.ok ? (r.json() as Promise<PriceData>) : null))
    .then((d) => {
      if (d) index = new Map(d.products.map((p) => [p.id, p]));
      return d;
    })
    .catch(() => null)
    // Bez datoteke s cijenama aplikacija radi dalje (popis, stalni artikli, kuponi), samo bez akcija.
    .then((d) => d ?? EMPTY);
  return cache;
}

export function setPriceDataForTests(d: PriceData) {
  cache = Promise.resolve(d);
  index = new Map(d.products.map((p) => [p.id, p]));
}

export function getProduct(id: string | null | undefined): Product | null {
  return (id && index?.get(id)) || null;
}

/** Cijena koju danas plaćaš: akcijska ako postoji, inače redovna. */
export function currentPrice(cp: ChainPrice | undefined): number | null {
  if (!cp) return null;
  return cp[1] ?? cp[0];
}

/** Je li proizvod na akciji i koliko (0-1). */
export function discount(cp: ChainPrice | undefined): number {
  if (!cp) return 0;
  const [regular, special] = cp;
  if (special != null && regular != null && special < regular) return 1 - special / regular;
  return 0;
}

export function isDeal(cp: ChainPrice | undefined): boolean {
  return discount(cp) >= 0.05;
}

export function productLabel(p: Product): string {
  const qty = p.q && p.u ? ` · ${p.q.replace(".", ",")} ${p.u}` : "";
  return `${p.n}${p.b && !p.n.toLowerCase().includes(p.b.toLowerCase()) ? ` (${p.b})` : ""}${qty}`;
}

export function searchProducts(data: PriceData, query: string, chains: string[], limit = 40): Product[] {
  if (query.trim().length < 2) return [];
  const out: { p: Product; s: number }[] = [];
  for (const p of data.products) {
    if (chains.length && !chains.some((c) => p.c[c])) continue;
    const s = matchScore(`${p.n} ${p.b}`, query);
    if (s > 0) out.push({ p, s });
  }
  return out.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.p);
}

/** Najjeftiniji lanac za proizvod, među odabranima. */
export function cheapest(p: Product, chains: string[]): { chain: string; price: number } | null {
  let best: { chain: string; price: number } | null = null;
  for (const c of chains) {
    const v = currentPrice(p.c[c]);
    if (v != null && (!best || v < best.price)) best = { chain: c, price: v };
  }
  return best;
}

export type BasketRow = { chain: string; total: number; found: number; missing: number };

/** Koliko bi današnji popis koštao u svakom lancu (samo stavke povezane s proizvodom). */
export function compareBasket(productIds: string[], chains: string[]): BasketRow[] {
  const rows = chains.map((chain) => {
    let total = 0, found = 0, missing = 0;
    for (const id of productIds) {
      const v = currentPrice(getProduct(id)?.c[chain]);
      if (v == null) missing++;
      else (total += v), found++;
    }
    return { chain, total: Math.round(total * 100) / 100, found, missing };
  });
  return rows.sort((a, b) => b.found - a.found || a.total - b.total);
}

export function allDeals(data: PriceData, chains: string[]): { p: Product; chain: string; d: number }[] {
  const out: { p: Product; chain: string; d: number }[] = [];
  for (const p of data.products) {
    for (const c of chains) {
      const d = discount(p.c[c]);
      if (d >= 0.05) out.push({ p, chain: c, d });
    }
  }
  return out.sort((a, b) => b.d - a.d);
}
