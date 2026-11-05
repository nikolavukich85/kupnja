import { useState } from "react";
import { useApp } from "../lib/ctx";
import { addItem, addStaple, deleteStaple, updateStaple, type Staple } from "../lib/db";
import { getProduct, productLabel } from "../lib/prices";
import { dueState, intervalLabel } from "../lib/recurring";
import { daysBetween, todayIso } from "../lib/text";
import { DealBadge, ErrorNote, ProductPicker, Sheet, StoreSelect } from "../components/ui";

const INTERVALS = [
  { v: 0, l: "Neka nauči" },
  { v: 3, l: "3 dana" },
  { v: 7, l: "Tjedan" },
  { v: 14, l: "2 tjedna" },
  { v: 30, l: "Mjesec" },
  { v: 60, l: "2 mjeseca" },
];

function StapleEditor({ staple, onClose }: { staple: Staple | null; onClose: () => void }) {
  const { family } = useApp();
  const [name, setName] = useState(staple?.name ?? "");
  const [store, setStore] = useState(staple?.store ?? "");
  const [productId, setProductId] = useState(staple?.productId ?? null);
  const [interval, setInterval] = useState(staple?.intervalDays ?? 0);
  const [paused, setPaused] = useState(staple?.paused ?? false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError("Upiši naziv.");
    try {
      const data = { name: name.trim(), store, productId, intervalDays: interval || null, paused };
      if (staple) await updateStaple(family.id, staple.id, data);
      else await addStaple(family.id, data);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Naziv</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. Mlijeko" autoFocus={!staple} />
      </div>
      <div>
        <label className="label">Koliko često (dok aplikacija ne nauči sama)</label>
        <div className="flex flex-wrap gap-1.5">
          {INTERVALS.map((i) => (
            <button type="button" key={i.v} className={`pill ${interval === i.v ? "pill-on" : ""}`} onClick={() => setInterval(i.v)}>{i.l}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Obično kupujemo u</label>
        <StoreSelect value={store} onChange={setStore} />
      </div>
      <div>
        <label className="label">Proizvod iz cjenika (za akcije)</label>
        <ProductPicker value={productId} onChange={setProductId} initialQuery={staple?.productId ? "" : name} />
      </div>
      {staple && (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
          Pauziraj podsjetnike
        </label>
      )}
      {staple && staple.history.length > 0 && (
        <p className="text-xs text-muted">Kupljeno: {[...staple.history].sort().reverse().slice(0, 8).map((d) => d.split("-").reverse().slice(0, 2).join(".") + ".").join(", ")}</p>
      )}
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={save}>Spremi</button>
        {staple && (
          <button
            className="btn-danger"
            onClick={async () => {
              if (!window.confirm(`Obrisati „${staple.name}“ iz stalnih artikala?`)) return;
              await deleteStaple(family.id, staple.id);
              onClose();
            }}
          >
            Obriši
          </button>
        )}
      </div>
    </div>
  );
}

export default function StaplesPage() {
  const { family, email, staples, items, storeName } = useApp();
  const [editing, setEditing] = useState<Staple | "new" | null>(null);
  if (!staples || !items) return <p className="p-6 text-muted">Učitavam…</p>;
  const onList = new Set(items.filter((i) => !i.done && i.stapleId).map((i) => i.stapleId));
  const rows = staples
    .map((s) => ({ s, st: dueState(s.history, s.intervalDays) }))
    .sort((a, b) => Number(a.s.paused) - Number(b.s.paused) || (a.st.daysLeft ?? 999) - (b.st.daysLeft ?? 999) || a.s.name.localeCompare(b.s.name, "hr"));

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="h-title">Stalno kupujemo</h1>
          <p className="text-sm text-muted">Aplikacija uči koliko često kupujete i podsjeća na vrijeme.</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setEditing("new")}>+ Novi</button>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-4 text-sm text-muted">
          Još nema stalnih artikala. Dodaj ih ovdje, ili na popisu otvori stavku i označi „Ovo kupujemo redovito“.
        </div>
      ) : (
        <ul className="card mt-4 divide-y divide-line p-0">
          {rows.map(({ s, st }) => {
            const last = [...s.history].sort().at(-1);
            const p = getProduct(s.productId);
            return (
              <li key={s.id} className={`flex items-center gap-3 px-4 py-3 ${s.paused ? "opacity-50" : ""}`}>
                <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(s)}>
                  <p className="text-[17px]">{s.name}</p>
                  <p className="truncate text-xs text-muted">
                    {intervalLabel(st.interval)}
                    {last && ` · zadnje prije ${daysBetween(last, todayIso())} d`}
                    {s.store && ` · ${storeName(s.store)}`}
                    {p && ` · ${productLabel(p)}`}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {!s.paused && st.due && <span className="chip bg-sea-soft text-sea">vrijeme je</span>}
                    {!s.paused && st.soon && <span className="chip bg-sea-soft text-sea">za {st.daysLeft} d</span>}
                    <DealBadge productId={s.productId} />
                  </div>
                </button>
                {onList.has(s.id) ? (
                  <span className="chip shrink-0">na popisu</span>
                ) : (
                  <button className="btn-ghost shrink-0 px-3 py-1.5" onClick={() => addItem(family.id, email, { name: s.name, stapleId: s.id, productId: s.productId, store: s.store })}>
                    + Popis
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Novi stalni artikl" : "Stalni artikl"}>
        {editing && <StapleEditor key={editing === "new" ? "new" : editing.id} staple={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}
