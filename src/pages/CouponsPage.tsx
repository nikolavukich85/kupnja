import { useState } from "react";
import { useApp } from "../lib/ctx";
import { addCoupon, deleteCoupon, updateCoupon, type Coupon } from "../lib/db";
import { daysBetween, todayIso } from "../lib/text";
import { ErrorNote, Sheet, StoreSelect } from "../components/ui";

/** Smanji fotografiju (najviše 1000 px, JPEG) da stane u bazu i brzo se učita. */
export async function shrinkImage(file: File, max = 1000, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Slika se ne može otvoriti."));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL("image/jpeg", quality);
    if (out.length > 700_000) out = c.toDataURL("image/jpeg", 0.5);
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function couponState(c: Coupon): { left: number | null; expired: boolean; soon: boolean } {
  if (!c.validUntil) return { left: null, expired: false, soon: false };
  const left = daysBetween(todayIso(), c.validUntil);
  return { left, expired: left < 0, soon: left >= 0 && left <= 3 };
}

function CouponEditor({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const { family } = useApp();
  const [title, setTitle] = useState(coupon?.title ?? "");
  const [store, setStore] = useState(coupon?.store ?? "");
  const [code, setCode] = useState(coupon?.code ?? "");
  const [value, setValue] = useState(coupon?.value ?? "");
  const [validUntil, setValidUntil] = useState(coupon?.validUntil ?? "");
  const [image, setImage] = useState(coupon?.image ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      setImage(await shrinkImage(f));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!title.trim() && !code.trim() && !image) return setError("Upiši barem naziv, kod ili dodaj sliku.");
    setBusy(true);
    try {
      const data = { title: title.trim() || "Kupon", store, code: code.trim(), value: value.trim(), validUntil, image };
      if (coupon) await updateCoupon(family.id, coupon.id, data);
      else await addCoupon(family.id, data);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Slika kupona</label>
        {image ? (
          <div className="relative">
            <img src={image} alt="Kupon" className="max-h-72 w-full rounded-xl border border-line object-contain" />
            <button type="button" className="btn-ghost absolute top-2 right-2 px-2 py-1 text-xs" onClick={() => setImage("")}>Ukloni</button>
          </div>
        ) : (
          <label className="btn-ghost w-full py-6">
            {busy ? "Obrađujem…" : "📷 Fotografiraj ili odaberi sliku"}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        )}
      </div>
      <div>
        <label className="label">Naziv</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="npr. −20 % na kozmetiku" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Vrijednost</label>
          <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="−20 % / 5 €" />
        </div>
        <div>
          <label className="label">Vrijedi do</label>
          <input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Kod (ako postoji)</label>
        <input className="input font-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="npr. JESEN20" autoCapitalize="characters" />
      </div>
      <div>
        <label className="label">Trgovina</label>
        <StoreSelect value={store} onChange={setStore} />
      </div>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={save} disabled={busy}>Spremi</button>
        {coupon && (
          <button
            className="btn-danger"
            onClick={async () => {
              if (!window.confirm("Obrisati kupon?")) return;
              await deleteCoupon(family.id, coupon.id);
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

function CouponCard({ c, onEdit, onView }: { c: Coupon; onEdit: () => void; onView: () => void }) {
  const { family, storeName } = useApp();
  const st = couponState(c);
  return (
    <li className={`card flex gap-3 p-3 ${c.used || st.expired ? "opacity-55" : ""} ${st.soon && !c.used ? "border-terra/50" : ""}`}>
      {c.image ? (
        <button onClick={onView} className="shrink-0">
          <img src={c.image} alt="" className="h-20 w-20 rounded-lg border border-line object-cover" />
        </button>
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-stone-bg text-3xl">🎟️</div>
      )}
      <button className="min-w-0 flex-1 text-left" onClick={onEdit}>
        <p className="font-medium leading-snug">{c.title}</p>
        <p className="truncate text-sm text-muted">
          {[c.value, storeName(c.store)].filter(Boolean).join(" · ")}
        </p>
        {c.code && <p className="mt-0.5 font-mono text-sm tracking-wide">{c.code}</p>}
        <div className="mt-1 flex flex-wrap gap-1">
          {c.used ? (
            <span className="chip">iskorišten</span>
          ) : st.expired ? (
            <span className="chip">istekao</span>
          ) : st.left === 0 ? (
            <span className="chip bg-terra-soft text-terra">ističe danas</span>
          ) : st.soon ? (
            <span className="chip bg-terra-soft text-terra">ističe za {st.left} d</span>
          ) : c.validUntil ? (
            <span className="chip">do {c.validUntil.split("-").reverse().join(".")}.</span>
          ) : null}
        </div>
      </button>
      {!st.expired && (
        <button
          className={`btn-ghost shrink-0 self-center px-3 py-1.5 text-xs ${c.used ? "" : "text-olive"}`}
          onClick={() => updateCoupon(family.id, c.id, { used: !c.used })}
        >
          {c.used ? "Vrati" : "✓ Iskorišten"}
        </button>
      )}
    </li>
  );
}

export default function CouponsPage() {
  const { coupons } = useApp();
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);
  const [viewing, setViewing] = useState<Coupon | null>(null);
  const [showOld, setShowOld] = useState(false);
  if (!coupons) return <p className="p-6 text-muted">Učitavam…</p>;

  const active = coupons
    .filter((c) => !c.used && !couponState(c).expired)
    .sort((a, b) => (a.validUntil || "9999").localeCompare(b.validUntil || "9999"));
  const old = coupons.filter((c) => c.used || couponState(c).expired);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="h-title">Kuponi</h1>
          <p className="text-sm text-muted">Na blagajni otvori kupon i pokaži sliku ili kod.</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setEditing("new")}>+ Kupon</button>
      </div>

      {active.length === 0 ? (
        <div className="card mt-4 text-sm text-muted">Nema aktivnih kupona. Fotografiraj kupon iz letka, s računa ili iz aplikacije trgovine.</div>
      ) : (
        <ul className="mt-4 space-y-2">
          {active.map((c) => <CouponCard key={c.id} c={c} onEdit={() => setEditing(c)} onView={() => setViewing(c)} />)}
        </ul>
      )}

      {old.length > 0 && (
        <div className="mt-6">
          <button className="link text-sm" onClick={() => setShowOld((v) => !v)}>
            {showOld ? "Sakrij" : "Prikaži"} iskorištene i istekle ({old.length})
          </button>
          {showOld && (
            <ul className="mt-2 space-y-2">
              {old.map((c) => <CouponCard key={c.id} c={c} onEdit={() => setEditing(c)} onView={() => setViewing(c)} />)}
            </ul>
          )}
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Novi kupon" : "Kupon"}>
        {editing && <CouponEditor key={editing === "new" ? "new" : editing.id} coupon={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      </Sheet>

      {viewing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-3" onClick={() => setViewing(null)}>
          <img src={viewing.image} alt="Kupon" className="max-h-[85vh] max-w-full object-contain" />
          {viewing.code && <p className="mt-3 font-mono text-2xl tracking-widest text-black">{viewing.code}</p>}
          <p className="mt-2 text-sm text-gray-500">Dodirni za zatvaranje</p>
        </div>
      )}
    </div>
  );
}
