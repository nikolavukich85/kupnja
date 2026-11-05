import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/ctx";
import { cheapest, currentPrice, discount, getProduct, productLabel, searchProducts, type Product } from "../lib/prices";
import { eur } from "../lib/text";

/** Donji list (sheet) za uređivanje na mobitelu. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl">{title}</h2>
          <button className="btn-ghost h-9 w-9 p-0" onClick={onClose} aria-label="Zatvori">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Oznaka akcije za proizvod: najbolja akcija među odabranim lancima. */
export function DealBadge({ productId }: { productId: string | null }) {
  const { chains, chainName } = useApp();
  const p = getProduct(productId);
  if (!p) return null;
  let best: { c: string; d: number; v: number } | null = null;
  for (const c of chains) {
    const d = discount(p.c[c]);
    if (d >= 0.05 && (!best || d > best.d)) best = { c, d, v: currentPrice(p.c[c])! };
  }
  if (!best) return null;
  return (
    <span className="chip bg-terra-soft text-terra">
      −{Math.round(best.d * 100)} % {chainName(best.c)} {eur(best.v)}
    </span>
  );
}

/** Cijene proizvoda po lancima, najpovoljnija istaknuta. */
export function PriceRow({ p }: { p: Product }) {
  const { chains, chainName } = useApp();
  const best = cheapest(p, chains);
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {chains
        .filter((c) => p.c[c])
        .map((c) => {
          const cp = p.c[c];
          const d = discount(cp);
          return (
            <span key={c} className={`chip ${best?.chain === c ? "bg-olive-soft text-olive" : ""}`}>
              {chainName(c)} {eur(currentPrice(cp))}
              {d >= 0.05 && <b className="ml-1 text-terra">−{Math.round(d * 100)}%</b>}
            </span>
          );
        })}
    </div>
  );
}

/** Pretraga proizvoda iz službenih cjenika (za povezivanje stavke s cijenama). */
export function ProductPicker({ value, onChange, initialQuery = "" }: { value: string | null; onChange: (id: string | null) => void; initialQuery?: string }) {
  const { prices, chains } = useApp();
  const [q, setQ] = useState(initialQuery);
  const results = useMemo(() => (prices ? searchProducts(prices, q, chains, 25) : []), [prices, q, chains]);
  const selected = getProduct(value);
  if (!prices) return <p className="text-sm text-muted">Cijene se učitavaju…</p>;
  if (!prices.products.length) return <p className="text-sm text-muted">Cjenici još nisu preuzeti (osvježavaju se jednom dnevno).</p>;
  if (!chains.length) return <p className="text-sm text-muted">Nijedna odabrana trgovina nema cjenike. Dodaj Lidl, Tommy ili Eurospin u Postavkama.</p>;
  return (
    <div>
      {selected ? (
        <div className="rounded-xl bg-stone-bg p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">{productLabel(selected)}</p>
            <button type="button" className="link text-xs" onClick={() => onChange(null)}>Ukloni</button>
          </div>
          <PriceRow p={selected} />
        </div>
      ) : (
        <>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Traži u cjenicima, npr. mlijeko dukat" />
          {q.trim().length >= 2 && (
            <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {results.length ? (
                results.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="w-full px-3 py-2 text-left hover:bg-stone-bg" onClick={() => onChange(p.id)}>
                      <span className="text-sm">{productLabel(p)}</span>
                      <PriceRow p={p} />
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm text-muted">Nema rezultata.</li>
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function StoreSelect({ value, onChange, allowEmpty = true }: { value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const { stores } = useApp();
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowEmpty && (
        <button type="button" className={`pill ${value === "" ? "pill-on" : ""}`} onClick={() => onChange("")}>Bilo gdje</button>
      )}
      {stores.map((s) => (
        <button type="button" key={s.id} className={`pill ${value === s.id ? "pill-on" : ""}`} onClick={() => onChange(s.id)}>
          {s.name}
        </button>
      ))}
    </div>
  );
}

export function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);
  return ref;
}

export function ErrorNote({ error }: { error: string | null }) {
  return error ? <p className="mt-2 rounded-lg bg-terra-soft px-3 py-2 text-sm text-terra">{error}</p> : null;
}
