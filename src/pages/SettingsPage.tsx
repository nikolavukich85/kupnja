import { useState } from "react";
import { useApp } from "../lib/ctx";
import { addMember, exportFamily, removeMember, signOut, updateFamily, type Store } from "../lib/db";
import { ErrorNote } from "../components/ui";

export default function SettingsPage() {
  const { family, email, prices } = useApp();
  const [name, setName] = useState(family.name);
  const [newMember, setNewMember] = useState("");
  const [newStore, setNewStore] = useState("");
  const [newChain, setNewChain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState("");

  const run = async (fn: () => Promise<unknown>, msg = "Spremljeno.") => {
    setError(null);
    try {
      await fn();
      setSaved(msg);
      setTimeout(() => setSaved(""), 2000);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stores = family.stores ?? [];
  const usedChains = new Set(stores.map((s) => s.chain));
  const availableChains = prices ? Object.entries(prices.chains).filter(([code]) => !usedChains.has(code)) : [];

  function addStore() {
    const n = newStore.trim() || (newChain && prices?.chains[newChain]?.name) || "";
    if (!n) return setError("Upiši naziv trgovine.");
    const id = n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trgovina";
    const uniq = stores.some((s) => s.id === id) ? `${id}-${Date.now().toString(36)}` : id;
    const next: Store[] = [...stores, { id: uniq, name: n, chain: newChain || null }];
    run(() => updateFamily(family.id, { stores: next }), "Trgovina dodana.").then(() => (setNewStore(""), setNewChain("")));
  }

  function moveStore(i: number, d: -1 | 1) {
    const next = [...stores];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    run(() => updateFamily(family.id, { stores: next }));
  }

  async function doExport() {
    const data = await exportFamily(family);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kupnja-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      <h1 className="h-title">Postavke</h1>
      <ErrorNote error={error} />
      {saved && <p className="rounded-lg bg-olive-soft px-3 py-2 text-sm text-olive">{saved}</p>}

      <section className="card space-y-3">
        <h2 className="h-section">Obitelj</h2>
        <div className="flex gap-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-ghost shrink-0" onClick={() => run(() => updateFamily(family.id, { name: name.trim() || "Naša obitelj" }))}>Spremi</button>
        </div>
        <div>
          <p className="label">Članovi (Google račun)</p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {family.members.map((m) => (
              <li key={m} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{m}{m === email && <span className="text-muted"> (ti)</span>}</span>
                {m !== email && (
                  <button className="link shrink-0 text-xs" onClick={() => window.confirm(`Ukloniti ${m}?`) && run(() => removeMember(family, m))}>Ukloni</button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-2">
          <input className="input" type="email" inputMode="email" value={newMember} onChange={(e) => setNewMember(e.target.value)} placeholder="gmail adresa člana" />
          <button className="btn-primary shrink-0" onClick={() => run(() => addMember(family, newMember), "Član dodan. Neka se prijavi tom adresom.").then(() => setNewMember(""))}>Dodaj</button>
        </div>
        <p className="text-xs text-muted">Dodani član otvori istu poveznicu, prijavi se Googleom i odmah vidi zajednički popis.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="h-section">Trgovine</h2>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {stores.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p>{s.name}</p>
                <p className="text-xs text-muted">{s.chain && prices?.chains[s.chain] ? "prate se cijene i akcije" : "bez službenog cjenika"}</p>
              </div>
              <button className="btn-ghost h-8 w-8 p-0" onClick={() => moveStore(i, -1)} aria-label="Gore">↑</button>
              <button className="btn-ghost h-8 w-8 p-0" onClick={() => moveStore(i, 1)} aria-label="Dolje">↓</button>
              <button
                className="btn-ghost h-8 w-8 p-0 text-terra"
                aria-label="Ukloni"
                onClick={() => window.confirm(`Ukloniti trgovinu ${s.name}? Stavke ostaju na popisu.`) && run(() => updateFamily(family.id, { stores: stores.filter((x) => x.id !== s.id) }))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-2 rounded-xl bg-stone-bg p-3">
          <p className="text-sm font-medium">Dodaj trgovinu</p>
          <select className="input" value={newChain} onChange={(e) => setNewChain(e.target.value)}>
            <option value="">Bez cjenika (samo popis i kuponi)</option>
            {availableChains.map(([code, c]) => (
              <option key={code} value={code}>{c.name} – s cijenama</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input className="input" value={newStore} onChange={(e) => setNewStore(e.target.value)} placeholder={newChain ? prices?.chains[newChain]?.name : "naziv, npr. DM"} />
            <button className="btn-primary shrink-0" onClick={addStore}>Dodaj</button>
          </div>
          {prices && availableChains.length === 0 && <p className="text-xs text-muted">Svi lanci s cjenicima su već dodani.</p>}
        </div>
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="h-section">Cijene</h2>
        {prices?.date ? (
          <p className="text-muted">
            Službeni cjenici trgovina (Odluka o objavi cjenika), osvježavaju se svaki dan. Zadnji: {(prices.date ?? "").split("-").reverse().join(".")}. ·{" "}
            {Object.values(prices.chains).reduce((a, c) => a + c.products, 0).toLocaleString("hr")} cijena.
          </p>
        ) : (
          <p className="text-muted">Cijene još nisu dostupne.</p>
        )}
        <p className="text-xs text-muted">Müller ne objavljuje strojno čitljiv cjenik pa za njega vrijede samo popis i kuponi.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="h-section">Podaci</h2>
        <p className="text-sm text-muted">Podaci se spremaju u oblak i rade i bez interneta (sinkroniziraju se čim se veza vrati).</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => run(doExport, "Kopija preuzeta.")}>Preuzmi sigurnosnu kopiju</button>
          <button className="btn-ghost" onClick={() => signOut()}>Odjava</button>
        </div>
        <p className="text-xs text-muted">Prijavljen: {email}</p>
      </section>
    </div>
  );
}
