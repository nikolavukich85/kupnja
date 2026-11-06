import { addRow, addRows, deleteRow, updateRow } from "./db";
import { todayIso } from "./text";

/**
 * Kućni novac: ručni unos prihoda i troškova, stalne mjesečne obveze (računi)
 * i pregled mjeseca. Bez povezivanja s bankom – namjerno jednostavno.
 */

export type Entry = {
  id: string;
  type: "in" | "out";
  amount: number;
  category: string;
  note: string;
  date: string; // GGGG-MM-DD
  by: string;
  billId: string | null;
};

export type Bill = {
  id: string;
  name: string;
  amount: number | null; // okvirni iznos; može se promijeniti pri plaćanju
  day: number | null; // dan u mjesecu; 31 = zadnji dan; null = bilo kad
  category: string;
  paid: string[]; // mjeseci GGGG-MM u kojima je plaćeno
  active: boolean;
  order: number;
};

export type Category = { id: string; label: string; icon: string };

export const OUT_CATS: Category[] = [
  { id: "hrana", label: "Hrana i kupnja", icon: "🛒" },
  { id: "kuca", label: "Kuća i režije", icon: "🏠" },
  { id: "djeca", label: "Djeca", icon: "🧒" },
  { id: "auto", label: "Auto i prijevoz", icon: "🚗" },
  { id: "zdravlje", label: "Zdravlje", icon: "💊" },
  { id: "odjeca", label: "Odjeća", icon: "👕" },
  { id: "izlasci", label: "Izlasci i zabava", icon: "🍕" },
  { id: "krediti", label: "Krediti i dugovi", icon: "💳" },
  { id: "desetina", label: "Desetina i darovi", icon: "🙏" },
  { id: "divine", label: "Divine Dalmatia", icon: "🧭" },
  { id: "stednja", label: "Štednja", icon: "🐷" },
  { id: "ostalo", label: "Ostalo", icon: "📦" },
];

export const IN_CATS: Category[] = [
  { id: "placa", label: "Plaća", icon: "💼" },
  { id: "djecji", label: "Dječji doplatak", icon: "🧸" },
  { id: "dodatno", label: "Dodatni posao", icon: "🧭" },
  { id: "ostalo-in", label: "Ostalo", icon: "💶" },
];

export const catOf = (id: string): Category =>
  OUT_CATS.find((c) => c.id === id) ?? IN_CATS.find((c) => c.id === id) ?? { id, label: id, icon: "📦" };

/** Stalne obveze s Nikoline stranice „Mjesečni budžet" – iznosi se upisuju naknadno. */
export const STARTER_BILLS: Omit<Bill, "id" | "paid" | "active" | "order">[] = [
  { name: "Režije", amount: null, day: null, category: "kuca" },
  { name: "Mobitel", amount: null, day: null, category: "kuca" },
  { name: "Smart Lift – račun 1", amount: null, day: null, category: "kuca" },
  { name: "Smart Lift – račun 2", amount: null, day: null, category: "kuca" },
  { name: "Smart Lift – račun 3", amount: null, day: null, category: "kuca" },
  { name: "Smart Lift – račun 4", amount: null, day: null, category: "kuca" },
  { name: "Mirela – kredit (kad stigne dječji)", amount: 200, day: null, category: "krediti" },
  { name: "Kartica Mirela", amount: null, day: null, category: "krediti" },
  { name: "Desetina – moja", amount: null, day: null, category: "desetina" },
  { name: "Desetina – Marinina plaća", amount: null, day: null, category: "desetina" },
  { name: "Igrajmo se", amount: null, day: null, category: "djeca" },
  { name: "Produženi boravak", amount: null, day: null, category: "djeca" },
  { name: "Vrtić", amount: null, day: null, category: "djeca" },
  { name: "Trener Josip", amount: null, day: null, category: "djeca" },
  { name: "Divine Dalmatia troškovi", amount: null, day: null, category: "divine" },
  { name: "Odjeća – kome što treba", amount: null, day: 31, category: "odjeca" },
  { name: "Shopping", amount: null, day: 31, category: "hrana" },
  { name: "Dugovi", amount: null, day: 31, category: "krediti" },
  { name: "Štednja i ulaganje", amount: null, day: 31, category: "stednja" },
];

// ---------- Datumi ----------

export const monthOf = (iso: string) => iso.slice(0, 7);
export const thisMonth = () => monthOf(todayIso());

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

const MONTHS = ["siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj", "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac"];
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const name = MONTHS[m - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}.`;
}

export function lastDay(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Iznos iz unosa: prihvaća 12,50 / 12.50 / 1.250,00 / 1 250. */
export function parseAmount(s: string): number | null {
  let t = s.replace(/\s|€/g, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (t.includes(",")) t = t.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// ---------- Pregled mjeseca ----------

export type Summary = { inSum: number; outSum: number; left: number; byCat: { cat: Category; sum: number }[] };

export function summarize(entries: Entry[], month: string): Summary {
  let inSum = 0;
  let outSum = 0;
  const by = new Map<string, number>();
  for (const e of entries) {
    if (monthOf(e.date) !== month) continue;
    if (e.type === "in") inSum += e.amount;
    else {
      outSum += e.amount;
      by.set(e.category, (by.get(e.category) ?? 0) + e.amount);
    }
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  const byCat = [...by.entries()].map(([id, sum]) => ({ cat: catOf(id), sum: r(sum) })).sort((a, b) => b.sum - a.sum);
  return { inSum: r(inSum), outSum: r(outSum), left: r(inSum - outSum), byCat };
}

export type BillState = { bill: Bill; paid: boolean; dueDay: number | null; late: boolean };

/** Obveze za mjesec: neplaćene prvo (bez roka redom kako su upisane, pa po danu dospijeća), „kasni" ako je dan prošao. */
export function billsFor(bills: Bill[], month: string, today = todayIso()): BillState[] {
  const ld = lastDay(month);
  const cur = monthOf(today);
  const dayNow = Number(today.slice(8, 10));
  return bills
    .filter((b) => b.active)
    .map((b) => {
      const dueDay = b.day == null ? null : Math.min(b.day, ld);
      const paid = b.paid.includes(month);
      const late = !paid && (month < cur || (month === cur && dueDay != null && dueDay < dayNow));
      return { bill: b, paid, dueDay, late };
    })
    .sort((a, b) => Number(a.paid) - Number(b.paid) || (a.dueDay ?? 0) - (b.dueDay ?? 0) || a.bill.order - b.bill.order);
}

/** Za značku na kartici: neplaćeno ovog mjeseca kojemu je rok danas ili prošao. */
export function dueCount(bills: Bill[] | null, today = todayIso()): number {
  if (!bills) return 0;
  const dayNow = Number(today.slice(8, 10));
  return billsFor(bills, monthOf(today), today).filter((s) => !s.paid && s.dueDay != null && s.dueDay <= dayNow).length;
}

// ---------- Spremanje ----------

export async function addEntry(fid: string, by: string, e: Omit<Entry, "id" | "by">) {
  return addRow(fid, "money", { ...e, note: e.note.trim(), by });
}
export const updateEntry = (fid: string, id: string, e: Partial<Entry>) => updateRow(fid, "money", id, e);
export const deleteEntry = (fid: string, id: string) => deleteRow(fid, "money", id);

export async function saveBill(fid: string, b: Partial<Bill> & { name: string }, id?: string) {
  const data = { name: b.name.trim(), amount: b.amount ?? null, day: b.day ?? null, category: b.category ?? "ostalo" };
  if (id) await updateRow(fid, "bills", id, data);
  else await addRow(fid, "bills", { ...data, paid: [], active: true, order: b.order ?? Date.now() });
}
export const archiveBill = (fid: string, id: string) => updateRow(fid, "bills", id, { active: false });

export async function addStarterBills(fid: string) {
  await addRows(fid, "bills", STARTER_BILLS.map((b, i) => ({ ...b, paid: [], active: true, order: i })));
}

/** Plaćeno: zapiše trošak u mjesec i označi obvezu. Poništavanje briše taj trošak. */
export async function payBill(fid: string, by: string, bill: Bill, month: string, amount: number | null) {
  if (amount && amount > 0) {
    const date = month === thisMonth() ? todayIso() : `${month}-${String(Math.min(bill.day ?? 1, lastDay(month))).padStart(2, "0")}`;
    await addEntry(fid, by, { type: "out", amount, category: bill.category, note: bill.name, date, billId: bill.id });
  }
  const patch: Partial<Bill> = { paid: [...new Set([...bill.paid, month])] };
  if (amount && !bill.amount) patch.amount = amount; // prvi upisani iznos postaje okvirni
  await updateRow(fid, "bills", bill.id, patch);
}

export async function unpayBill(fid: string, bill: Bill, month: string, entries: Entry[]) {
  for (const e of entries.filter((x) => x.billId === bill.id && monthOf(x.date) === month)) await deleteEntry(fid, e.id);
  await updateRow(fid, "bills", bill.id, { paid: bill.paid.filter((m) => m !== month) });
}
