import { useMemo, useState } from "react";
import { useApp } from "../lib/ctx";
import { addItem, addStaple, clearBought, deleteItem, findStapleByName, toggleBought, updateItem, type Item, type Staple } from "../lib/db";
import { compareBasket, getProduct, productLabel, searchProducts } from "../lib/prices";
import { dueState } from "../lib/recurring";
import { eur, matchScore } from "../lib/text";
import { DealBadge, ErrorNote, ProductPicker, Sheet, StoreSelect } from "../components/ui";

function AddBar() {
  const { family, email, staples, prices, chains } = useApp();
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const q = text.trim();

  const stapleHits = useMemo(
    () => (q.length >= 1 && staples ? staples.map((s) => ({ s, sc: matchScore(s.name, q) })).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 4).map((x) => x.s) : []),
    [q, staples]
  );
  const productHits = useMemo(() => (q.length >= 3 && prices ? searchProducts(prices, q, chains, 5) : []), [q, prices, chains]);

  async function add(name: string, extra: Partial<Item> = {}) {
    setText("");
    const staple = extra.stapleId ? null : staples && findStapleByName(staples, name);
    await addItem(family.id, email, {
      name,
      stapleId: extra.stapleId ?? staple?.id ?? null,
      productId: extra.productId ?? staple?.productId ?? null,
      store: extra.store ?? staple?.store ?? "",
      ...extra,
    });
  }

  return (
    <div className="relative">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q) void add(q);
        }}
      >
        <input
          className="input text-base"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          placeholder="Dodaj na popis…"
          enterKeyHint="done"
          autoComplete="off"
        />
        <button className="btn-primary shrink-0 px-4" disabled={!q}>Dodaj</button>
      </form>
      {focus && (stapleHits.length > 0 || productHits.length > 0) && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-paper shadow-lg">
          {stapleHits.map((s) => (
            <button key={s.id} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-stone-bg" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s.name, { stapleId: s.id, productId: s.productId, store: s.store })}>
              <span className="chip">stalno</span> {s.name}
            </button>
          ))}
          {productHits.map((p) => (
            <button key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-bg" onMouseDown={(e) => e.preventDefault()} onClick={() => add(p.n, { productId: p.id })}>
              {productLabel(p)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemEditor({ item, onClose }: { item: Item; onClose: () => void }) {
  const { family, staples } = useApp();
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty);
  const [note, setNote] = useState(item.note);
  const [store, setStore] = useState(item.store);
  const [productId, setProductId] = useState(item.productId);
  const [recurring, setRecurring] = useState(!!item.stapleId);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      let stapleId = item.stapleId;
      if (recurring && !stapleId) {
        stapleId = findStapleByName(staples ?? [], name)?.id ?? (await addStaple(family.id, { name, store, productId }));
      }
      if (!recurring) stapleId = null;
      await updateItem(family.id, item.id, { name: name.trim() || item.name, qty, note, store, productId, stapleId });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <div>
          <label className="label">Što</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Koliko</label>
          <input className="input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="2 kom" />
        </div>
      </div>
      <div>
        <label className="label">Napomena</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="npr. bez laktoze" />
      </div>
      <div>
        <label className="label">Trgovina</label>
        <StoreSelect value={store} onChange={setStore} />
      </div>
      <div>
        <label className="label">Proizvod iz cjenika (za cijene i akcije)</label>
        <ProductPicker value={productId} onChange={setProductId} initialQuery={item.productId ? "" : item.name} />
      </div>
      <label className="flex items-center gap-3 rounded-xl bg-stone-bg p-3 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
        <span>Ovo kupujemo redovito (aplikacija uči koliko često i podsjeća)</span>
      </label>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={save}>Spremi</button>
        <button
          className="btn-danger"
          onClick={async () => {
            await deleteItem(family.id, item.id);
            onClose();
          }}
        >
          Obriši
        </button>
      </div>
    </div>
  );
}

function ItemRow({ item, onEdit }: { item: Item; onEdit: () => void }) {
  const { family } = useApp();
  const p = getProduct(item.productId);
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <button
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${item.done ? "border-olive bg-olive text-paper" : "border-line"}`}
        onClick={() => toggleBought(family.id, item)}
        aria-label={item.done ? "Vrati na popis" : "Označi kupljeno"}
      >
        {item.done && "✓"}
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={onEdit}>
        <p className={`text-[17px] leading-snug ${item.done ? "text-muted line-through" : ""}`}>
          {item.name}
          {item.qty && <span className="ml-1.5 text-sm text-muted">{item.qty}</span>}
        </p>
        {(item.note || p) && <p className="truncate text-xs text-muted">{[item.note, p && productLabel(p)].filter(Boolean).join(" · ")}</p>}
        {!item.done && (
          <div className="mt-1 flex flex-wrap gap-1">
            <DealBadge productId={item.productId} />
            {item.stapleId && <span className="chip">stalno</span>}
          </div>
        )}
      </button>
    </li>
  );
}

function Suggestions({ items, staples }: { items: Item[]; staples: Staple[] }) {
  const { family, email } = useApp();
  const onList = new Set(items.filter((i) => !i.done && i.stapleId).map((i) => i.stapleId));
  const due = staples
    .filter((s) => !s.paused && !onList.has(s.id))
    .map((s) => ({ s, st: dueState(s.history, s.intervalDays) }))
    .filter((x) => x.st.due || x.st.soon)
    .sort((a, b) => (a.st.daysLeft ?? 0) - (b.st.daysLeft ?? 0));
  if (!due.length) return null;
  return (
    <div className="card mt-4 border-sea/30 bg-sea-soft/40">
      <p className="mb-2 text-sm font-medium text-sea">Uskoro treba kupiti</p>
      <div className="flex flex-wrap gap-2">
        {due.map(({ s, st }) => (
          <button key={s.id} className="pill bg-paper" onClick={() => addItem(family.id, email, { name: s.name, stapleId: s.id, productId: s.productId, store: s.store })}>
            + {s.name}
            <span className="ml-1 text-xs text-muted">{st.due ? "vrijeme je" : `za ${st.daysLeft} d`}</span>
          </button>
        ))}
        <button className="pill bg-paper font-medium text-sea" onClick={() => due.forEach(({ s }) => addItem(family.id, email, { name: s.name, stapleId: s.id, productId: s.productId, store: s.store }))}>
          Dodaj sve
        </button>
      </div>
    </div>
  );
}

function Basket({ items }: { items: Item[] }) {
  const { chains, chainName } = useApp();
  const ids = items.filter((i) => !i.done && i.productId).map((i) => i.productId!);
  if (ids.length < 2 || chains.length < 2) return null;
  const rows = compareBasket(ids, chains);
  return (
    <div className="card mt-4">
      <p className="mb-2 text-sm font-medium">Gdje je popis najpovoljniji</p>
      <ul className="space-y-1.5 text-sm">
        {rows.map((r, i) => (
          <li key={r.chain} className="flex items-baseline justify-between">
            <span className={i === 0 ? "font-medium text-olive" : ""}>{chainName(r.chain)}</span>
            <span className="tabular-nums">
              {eur(r.total)}
              {r.missing > 0 && <span className="ml-2 text-xs text-muted">({r.missing} nema)</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Za {ids.length} stavki povezanih s cjenikom, današnje cijene u Zadru.</p>
    </div>
  );
}

export default function ListPage() {
  const { family, items, staples, stores, storeName } = useApp();
  const [editing, setEditing] = useState<Item | null>(null);
  const [filter, setFilter] = useState<string>("sve");
  if (!items || !staples) return <p className="p-6 text-muted">Učitavam…</p>;

  const open = items.filter((i) => !i.done && (filter === "sve" || i.store === filter || (filter !== "" && i.store === "")));
  const bought = items.filter((i) => i.done).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  const groups = new Map<string, Item[]>();
  for (const it of open.sort((a, b) => (a.createdAt?.seconds ?? 9e9) - (b.createdAt?.seconds ?? 9e9))) {
    const k = it.store || "";
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const order = ["", ...stores.map((s) => s.id)].filter((k) => groups.has(k));

  return (
    <div>
      <AddBar />
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {[{ id: "sve", name: "Sve" }, ...stores].map((s) => (
          <button key={s.id} className={`pill shrink-0 ${filter === s.id ? "pill-on" : ""}`} onClick={() => setFilter(s.id)}>
            {s.name}
          </button>
        ))}
      </div>

      {open.length === 0 ? (
        <div className="card mt-4 text-center text-muted">
          <p className="text-3xl">🧺</p>
          <p className="mt-1">{filter === "sve" ? "Popis je prazan." : "Za ovu trgovinu nema ništa."}</p>
        </div>
      ) : (
        order.map((k) => (
          <section key={k || "x"} className="mt-4">
            <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">{k ? storeName(k) : "Bilo gdje"}</h2>
            <ul className="card divide-y divide-line p-0">
              {groups.get(k)!.map((it) => <ItemRow key={it.id} item={it} onEdit={() => setEditing(it)} />)}
            </ul>
          </section>
        ))
      )}

      <Suggestions items={items} staples={staples} />
      <Basket items={items} />

      {bought.length > 0 && (
        <section className="mt-6">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Kupljeno ({bought.length})</h2>
            <button className="link text-sm" onClick={() => clearBought(family.id, items)}>Ukloni kupljeno</button>
          </div>
          <ul className="card divide-y divide-line p-0 opacity-80">
            {bought.slice(0, 30).map((it) => <ItemRow key={it.id} item={it} onEdit={() => setEditing(it)} />)}
          </ul>
        </section>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Stavka">
        {editing && <ItemEditor key={editing.id} item={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}
