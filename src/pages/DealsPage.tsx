import { useMemo, useState } from "react";
import { useApp } from "../lib/ctx";
import { addItem } from "../lib/db";
import { allDeals, currentPrice, getProduct, isDeal, productLabel, type Product } from "../lib/prices";
import { eur, matchScore } from "../lib/text";

function DealRow({ p, chain, d }: { p: Product; chain: string; d: number }) {
  const { family, email, items, chainName, stores } = useApp();
  const onList = items?.some((i) => !i.done && i.productId === p.id);
  const cp = p.c[chain];
  const store = stores.find((s) => s.chain === chain)?.id ?? "";
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug">{productLabel(p)}</p>
        <p className="mt-0.5 text-sm">
          <span className="font-medium">{chainName(chain)}</span> <b className="text-terra">{eur(currentPrice(cp))}</b>{" "}
          <span className="text-muted line-through">{eur(cp[0])}</span> <span className="chip bg-terra-soft text-terra">−{Math.round(d * 100)} %</span>
        </p>
      </div>
      {onList ? (
        <span className="chip shrink-0">na popisu</span>
      ) : (
        <button className="btn-ghost shrink-0 px-3 py-1.5" onClick={() => addItem(family.id, email, { name: p.n, productId: p.id, store })}>+ Popis</button>
      )}
    </li>
  );
}

export default function DealsPage() {
  const { prices, chains, chainName, staples, items } = useApp();
  const [chain, setChain] = useState<string>("sve");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(60);

  const mine = useMemo(() => {
    const ids = new Set([...(staples ?? []).map((s) => s.productId), ...(items ?? []).filter((i) => !i.done).map((i) => i.productId)].filter(Boolean) as string[]);
    const out: { p: Product; chain: string; d: number }[] = [];
    for (const id of ids) {
      const p = getProduct(id);
      if (!p) continue;
      for (const c of chains) if (isDeal(p.c[c])) out.push({ p, chain: c, d: 1 - (p.c[c][1]! / p.c[c][0]!) });
    }
    return out.sort((a, b) => b.d - a.d);
  }, [staples, items, chains, prices]);

  const all = useMemo(() => (prices ? allDeals(prices, chain === "sve" ? chains : [chain]) : []), [prices, chains, chain]);
  const filtered = useMemo(() => (q.trim().length >= 2 ? all.filter((x) => matchScore(`${x.p.n} ${x.p.b} ${x.p.k}`, q) > 0) : all), [all, q]);

  if (!prices) return <p className="p-6 text-muted">Učitavam cijene…</p>;
  if (!prices.products.length) return <div><h1 className="h-title">Akcije</h1><p className="card mt-4 text-sm text-muted">Cjenici još nisu preuzeti. Osvježavaju se automatski jednom dnevno – pogledaj ponovno sutra.</p></div>;
  if (!chains.length) return <div><h1 className="h-title">Akcije</h1><p className="card mt-4 text-sm text-muted">Nijedna odabrana trgovina nema cjenike. U Postavkama dodaj Lidl, Tommy ili Eurospin.</p></div>;

  const upd = prices.date ? prices.date.split("-").reverse().join(".") + "." : "";
  return (
    <div>
      <h1 className="h-title">Akcije</h1>
      <p className="text-sm text-muted">
        Službeni cjenici{upd && ` od ${upd}`} ·{" "}
        {chains.map((c) => `${chainName(c)}${prices.chains[c]?.scope === "local" ? " (Zadar)" : ""}`).join(", ")}
      </p>

      <section className="mt-4">
        <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">Vaši artikli na akciji</h2>
        {mine.length ? (
          <ul className="card divide-y divide-line border-terra/30 p-0">{mine.map((x) => <DealRow key={x.p.id + x.chain} {...x} />)}</ul>
        ) : (
          <p className="card text-sm text-muted">Trenutno ništa od vaših stalnih artikala nije na akciji. Poveži artikle s proizvodima iz cjenika da bi ih aplikacija pratila.</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">Sve akcije ({filtered.length})</h2>
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {["sve", ...chains].map((c) => (
            <button key={c} className={`pill shrink-0 ${chain === c ? "pill-on" : ""}`} onClick={() => (setChain(c), setShown(60))}>
              {c === "sve" ? "Sve trgovine" : chainName(c)}
            </button>
          ))}
        </div>
        <input className="input mb-2" value={q} onChange={(e) => (setQ(e.target.value), setShown(60))} placeholder="Traži među akcijama…" type="search" />
        <ul className="card divide-y divide-line p-0">
          {filtered.slice(0, shown).map((x) => <DealRow key={x.p.id + x.chain} {...x} />)}
        </ul>
        {filtered.length > shown && (
          <button className="btn-ghost mt-3 w-full" onClick={() => setShown((s) => s + 60)}>Prikaži još</button>
        )}
      </section>
    </div>
  );
}
