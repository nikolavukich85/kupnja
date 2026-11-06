import { useMemo, useState } from "react";
import { useApp } from "../lib/ctx";
import {
  IN_CATS,
  OUT_CATS,
  addEntry,
  addStarterBills,
  archiveBill,
  billsFor,
  catOf,
  deleteEntry,
  monthLabel,
  monthOf,
  parseAmount,
  payBill,
  saveBill,
  shiftMonth,
  summarize,
  thisMonth,
  unpayBill,
  updateEntry,
  type Bill,
  type Entry,
} from "../lib/money";
import { eur, todayIso } from "../lib/text";
import { ErrorNote, Sheet, useAutoFocus } from "../components/ui";

const who = (email: string, me: string) => (email === me ? "ti" : email.split("@")[0]);
const dd = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;

// ---------- Unos prihoda / troška ----------

function EntryEditor({ type, entry, month, onClose }: { type: "in" | "out"; entry: Entry | null; month: string; onClose: () => void }) {
  const { family, email, stores } = useApp();
  const cats = type === "in" ? IN_CATS : OUT_CATS;
  const [amount, setAmount] = useState(entry ? String(entry.amount).replace(".", ",") : "");
  const [category, setCategory] = useState(entry?.category ?? cats[0].id);
  const [note, setNote] = useState(entry?.note ?? "");
  const defaultDate = month === thisMonth() ? todayIso() : `${month}-01`;
  const [date, setDate] = useState(entry?.date ?? defaultDate);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useAutoFocus<HTMLInputElement>();

  async function save() {
    const a = parseAmount(amount);
    if (!a) return setError("Upiši iznos, npr. 23,50.");
    setBusy(true);
    try {
      if (entry) await updateEntry(family.id, entry.id, { amount: a, category, note: note.trim(), date });
      else await addEntry(family.id, email, { type, amount: a, category, note, date, billId: null });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), save())}>
      <div className="relative">
        <input
          ref={ref}
          className="input py-3 pr-10 text-center font-serif text-3xl"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          aria-label="Iznos"
        />
        <span className="absolute top-1/2 right-4 -translate-y-1/2 text-xl text-muted">€</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cats.map((c) => (
          <button
            type="button"
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] leading-tight ${category === c.id ? "border-sea bg-sea-soft text-sea font-semibold" : "border-line text-muted"}`}
          >
            <span className="text-xl">{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>
      {type === "out" && category === "hrana" && (
        <div className="flex flex-wrap gap-1.5">
          {stores.map((s) => (
            <button type="button" key={s.id} className={`pill ${note === s.name ? "pill-on" : ""}`} onClick={() => setNote(note === s.name ? "" : s.name)}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "in" ? "npr. Plaća – Marina" : "bilješka (nije obavezno)"} />
        <input className="input w-40 shrink-0" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Datum" />
      </div>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        {entry && (
          <button type="button" className="btn-danger" onClick={() => window.confirm("Obrisati ovaj unos?") && deleteEntry(family.id, entry.id).then(onClose)}>
            Obriši
          </button>
        )}
        <button className={`${type === "in" ? "btn-primary" : "btn-terra"} flex-1 py-3`} disabled={busy}>
          {entry ? "Spremi" : type === "in" ? "Dodaj prihod" : "Dodaj trošak"}
        </button>
      </div>
    </form>
  );
}

// ---------- Stalne obveze ----------

function BillEditor({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
  const { family } = useApp();
  const [name, setName] = useState(bill?.name ?? "");
  const [amount, setAmount] = useState(bill?.amount ? String(bill.amount).replace(".", ",") : "");
  const [day, setDay] = useState(bill?.day ? String(bill.day) : "");
  const [category, setCategory] = useState(bill?.category ?? "kuca");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError("Upiši naziv.");
    const d = day ? Math.min(31, Math.max(1, Number(day))) : null;
    try {
      await saveBill(family.id, { name, amount: parseAmount(amount), day: d, category }, bill?.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), save())}>
      <div>
        <label className="label">Naziv</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. Vrtić" />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="label">Okvirni iznos</label>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="€ (nije obavezno)" />
        </div>
        <div className="w-32">
          <label className="label">Dan u mj.</label>
          <input className="input" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, ""))} placeholder="31 = zadnji" />
        </div>
      </div>
      <div>
        <label className="label">Kategorija</label>
        <div className="flex flex-wrap gap-1.5">
          {OUT_CATS.map((c) => (
            <button type="button" key={c.id} className={`pill ${category === c.id ? "pill-on" : ""}`} onClick={() => setCategory(c.id)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        {bill && (
          <button type="button" className="btn-danger" onClick={() => window.confirm(`Maknuti „${bill.name}" sa stalnih obveza? Dosadašnji troškovi ostaju.`) && archiveBill(family.id, bill.id).then(onClose)}>
            Makni
          </button>
        )}
        <button className="btn-primary flex-1 py-3">Spremi</button>
      </div>
    </form>
  );
}

function PaySheet({ bill, month, onClose }: { bill: Bill; month: string; onClose: () => void }) {
  const { family, email } = useApp();
  const [amount, setAmount] = useState(bill.amount ? String(bill.amount).replace(".", ",") : "");
  const [busy, setBusy] = useState(false);
  const ref = useAutoFocus<HTMLInputElement>();
  async function pay(withAmount: boolean) {
    setBusy(true);
    await payBill(family.id, email, bill, month, withAmount ? parseAmount(amount) : null);
    onClose();
  }
  return (
    <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), pay(true))}>
      <p className="text-sm text-muted">Koliko je plaćeno? Iznos ide u troškove za {monthLabel(month).toLowerCase()}</p>
      <input ref={ref} className="input py-3 text-center font-serif text-3xl" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00 €" />
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => pay(false)}>Samo označi</button>
        <button className="btn-primary flex-1 py-3" disabled={busy}>Plaćeno ✓</button>
      </div>
    </form>
  );
}

// ---------- Stranica ----------

export default function MoneyPage() {
  const { family, email, money, bills } = useApp();
  const [month, setMonth] = useState(thisMonth());
  const [adding, setAdding] = useState<"in" | "out" | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [paying, setPaying] = useState<Bill | null>(null);
  const [billEdit, setBillEdit] = useState<Bill | "new" | null>(null);
  const [showPaid, setShowPaid] = useState(false);
  const [manage, setManage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = useMemo(() => money ?? [], [money]);
  const sum = useMemo(() => summarize(entries, month), [entries, month]);
  const states = useMemo(() => billsFor(bills ?? [], month), [bills, month]);
  const monthEntries = useMemo(
    () => entries.filter((e) => monthOf(e.date) === month).sort((a, b) => b.date.localeCompare(a.date)),
    [entries, month]
  );
  const unpaid = states.filter((s) => !s.paid);
  const paid = states.filter((s) => s.paid);
  const unpaidKnown = unpaid.reduce((a, s) => a + (s.bill.amount ?? 0), 0);
  const maxCat = Math.max(1, ...sum.byCat.map((c) => c.sum));
  const spentPct = sum.inSum > 0 ? Math.min(100, Math.round((sum.outSum / sum.inSum) * 100)) : 0;

  if (!money || !bills) return <p className="p-6 text-muted">Učitavam…</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="h-title">Novac</h1>
        <div className="flex items-center gap-1">
          <button className="btn-ghost h-9 w-9 p-0" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Prethodni mjesec">‹</button>
          <span className="min-w-[9.5rem] text-center text-sm font-medium">{monthLabel(month)}</span>
          <button className="btn-ghost h-9 w-9 p-0" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Sljedeći mjesec" disabled={month >= thisMonth()}>›</button>
        </div>
      </div>
      <ErrorNote error={error} />

      <section className="card space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="label">Ušlo</p>
            <p className="font-serif text-xl text-olive">{eur(sum.inSum)}</p>
          </div>
          <div>
            <p className="label">Izašlo</p>
            <p className="font-serif text-xl text-terra">{eur(sum.outSum)}</p>
          </div>
          <div>
            <p className="label">Ostaje</p>
            <p className={`font-serif text-xl ${sum.left < 0 ? "text-terra" : "text-ink"}`}>{eur(sum.left)}</p>
          </div>
        </div>
        {sum.inSum > 0 && (
          <div className="h-2 overflow-hidden rounded-full bg-olive-soft" title={`Potrošeno ${spentPct} %`}>
            <div className={`h-full ${spentPct >= 90 ? "bg-terra" : "bg-sea"}`} style={{ width: `${spentPct}%` }} />
          </div>
        )}
        {unpaidKnown > 0 && <p className="text-center text-xs text-muted">Još za platiti ovaj mjesec (okvirno): {eur(unpaidKnown)}</p>}
        <div className="flex gap-2">
          <button className="btn-terra flex-1 py-3 text-base" onClick={() => setAdding("out")}>− Trošak</button>
          <button className="btn-primary flex-1 py-3 text-base" onClick={() => setAdding("in")}>+ Prihod</button>
        </div>
      </section>

      <section>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Za platiti ({unpaid.length})</h2>
          {bills.some((b) => b.active) && (
            <button className="link text-xs" onClick={() => setManage((m) => !m)}>{manage ? "Gotovo" : "Uredi obveze"}</button>
          )}
        </div>
        {!bills.some((b) => b.active) ? (
          <div className="card space-y-3 text-sm">
            <p className="text-muted">Ovdje idu stalne mjesečne obveze (režije, vrtić, krediti…). Svaki mjesec se same vrate, a kad platiš – kvačica.</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => addStarterBills(family.id).catch((e) => setError(e.message))}>Dodaj naše s Notion popisa</button>
              <button className="btn-ghost" onClick={() => setBillEdit("new")}>Dodaj jednu</button>
            </div>
          </div>
        ) : (
          <ul className="card divide-y divide-line p-0">
            {(manage ? states : unpaid).map(({ bill, dueDay, late, paid: isPaid }) => (
              <li key={bill.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-lg">{catOf(bill.category).icon}</span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[15px] ${isPaid ? "text-muted line-through" : ""}`}>{bill.name}</p>
                  <p className={`text-xs ${late ? "text-terra font-medium" : "text-muted"}`}>
                    {bill.amount ? eur(bill.amount) : "iznos —"}
                    {dueDay != null && ` · ${bill.day === 31 ? "zadnji dan" : `do ${dueDay}.`}`}
                    {late && " · kasni"}
                  </p>
                </div>
                {manage ? (
                  <button className="btn-ghost shrink-0 px-3 py-1.5" onClick={() => setBillEdit(bill)}>Uredi</button>
                ) : (
                  <button className="btn-ghost shrink-0 px-3 py-1.5" onClick={() => setPaying(bill)}>Plati</button>
                )}
              </li>
            ))}
            {!manage && !unpaid.length && <li className="px-4 py-3 text-sm text-olive">Sve plaćeno za ovaj mjesec ✓</li>}
            {manage && (
              <li className="px-4 py-2.5">
                <button className="link text-sm" onClick={() => setBillEdit("new")}>+ Nova obveza</button>
              </li>
            )}
          </ul>
        )}
        {!manage && paid.length > 0 && (
          <div className="mt-2">
            <button className="link px-1 text-xs" onClick={() => setShowPaid((s) => !s)}>{showPaid ? "Sakrij" : "Prikaži"} plaćeno ({paid.length})</button>
            {showPaid && (
              <ul className="card mt-1.5 divide-y divide-line p-0">
                {paid.map(({ bill }) => (
                  <li key={bill.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="text-olive">✓</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{bill.name}</span>
                    <button className="link shrink-0 text-xs" onClick={() => unpayBill(family.id, bill, month, entries)}>poništi</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {sum.byCat.length > 0 && (
        <section>
          <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">Kamo je otišlo</h2>
          <ul className="card space-y-2.5">
            {sum.byCat.map(({ cat, sum: s }) => (
              <li key={cat.id}>
                <div className="flex justify-between text-sm">
                  <span>{cat.icon} {cat.label}</span>
                  <span className="font-medium">{eur(s)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-bg">
                  <div className="h-full rounded-full bg-sea" style={{ width: `${Math.round((s / maxCat) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">Unosi ({monthEntries.length})</h2>
        {monthEntries.length ? (
          <ul className="card divide-y divide-line p-0">
            {monthEntries.map((e) => (
              <li key={e.id}>
                <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-bg" onClick={() => setEditing(e)}>
                  <span className="text-lg">{catOf(e.category).icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px]">{e.note || catOf(e.category).label}</p>
                    <p className="text-xs text-muted">{dd(e.date)} · {who(e.by, email)}</p>
                  </div>
                  <span className={`shrink-0 font-medium ${e.type === "in" ? "text-olive" : ""}`}>{e.type === "in" ? "+" : "−"}{eur(e.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card text-sm text-muted">Još nema unosa za ovaj mjesec. Počni s plaćom: „+ Prihod".</p>
        )}
      </section>

      <Sheet open={!!adding} onClose={() => setAdding(null)} title={adding === "in" ? "Novi prihod" : "Novi trošak"}>
        {adding && <EntryEditor type={adding} entry={null} month={month} onClose={() => setAdding(null)} />}
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Uredi unos">
        {editing && <EntryEditor type={editing.type} entry={editing} month={month} onClose={() => setEditing(null)} />}
      </Sheet>
      <Sheet open={!!paying} onClose={() => setPaying(null)} title={paying?.name ?? ""}>
        {paying && <PaySheet bill={paying} month={month} onClose={() => setPaying(null)} />}
      </Sheet>
      <Sheet open={!!billEdit} onClose={() => setBillEdit(null)} title={billEdit === "new" ? "Nova obveza" : "Uredi obvezu"}>
        {billEdit && <BillEditor bill={billEdit === "new" ? null : billEdit} onClose={() => setBillEdit(null)} />}
      </Sheet>
    </div>
  );
}
