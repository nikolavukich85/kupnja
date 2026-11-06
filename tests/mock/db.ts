// Zamjena za Firebase sloj samo za lokalno testiranje sučelja (npm run dev -- --mode mock).
import { useEffect, useState } from "react";
import type { Coupon, Family, Item, Staple, Store } from "../../src/lib/db";
export type { Coupon, Family, Item, Staple, Store } from "../../src/lib/db";
import { norm, todayIso } from "../../src/lib/text";

export const configured = true;
export const auth = null;
export const fs = null;
export const DEFAULT_STORES: Store[] = [
  { id: "eurospin", name: "Eurospin", chain: "eurospin" },
  { id: "lidl", name: "Lidl", chain: "lidl" },
  { id: "mueller", name: "Müller", chain: null },
  { id: "tommy", name: "Tommy", chain: "tommy" },
];

const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
const user = { email: "nikola@example.com", uid: "u1" } as never;
let family: Family | null = { id: "f1", name: "Vukić", members: ["nikola@example.com", "marina@example.com"], stores: DEFAULT_STORES };
let n = 100;
const db: Record<string, Record<string, unknown>[]> = {
  items: [
    { id: "i1", name: "Kruh", qty: "", note: "", store: "", stapleId: null, productId: null, done: false, addedBy: "marina@example.com" },
    { id: "i2", name: "Mlijeko", qty: "2", note: "", store: "lidl", stapleId: "s1", productId: "3850000000001", done: false, addedBy: "nikola@example.com" },
  ],
  staples: [
    { id: "s1", name: "Mlijeko", category: "", store: "lidl", productId: "3850000000001", intervalDays: null, history: [ago(12), ago(8), ago(4)], paused: false },
    { id: "s2", name: "Kava", category: "", store: "", productId: "lidl:2", intervalDays: 14, history: [ago(15)], paused: false },
    { id: "s3", name: "Šampon", category: "", store: "mueller", productId: null, intervalDays: 30, history: [ago(5)], paused: false },
  ],
  money: [
    { id: "m1", type: "in", amount: 1450, category: "placa", note: "Plaća – Nikola", date: ago(5), by: "nikola@example.com", billId: null },
    { id: "m2", type: "out", amount: 63.4, category: "hrana", note: "Lidl", date: ago(2), by: "marina@example.com", billId: null },
    { id: "m3", type: "out", amount: 18, category: "izlasci", note: "Sladoled", date: ago(1), by: "nikola@example.com", billId: null },
  ],
  bills: [],
  coupons: [
    { id: "c1", store: "mueller", title: "−20 % na kozmetiku", code: "JESEN20", value: "−20 %", validUntil: ago(-2), image: "", used: false },
  ],
};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((x) => x + 1);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
}

export function useUser() {
  useTick();
  return { user: family || user ? user : null, ready: true };
}
export const signIn = async () => {};
export const signOut = async () => {};
export function useFamily(_email: string | null) {
  useTick();
  return { family: family ? { ...family } : null, loading: false };
}
export async function createFamily(email: string, name: string) {
  family = { id: "f1", name, members: [email], stores: DEFAULT_STORES };
  emit();
  return "f1";
}
export async function updateFamily(_fid: string, data: Partial<Family>) {
  family = { ...family!, ...data };
  emit();
}
export async function addMember(f: Family, email: string) {
  await updateFamily(f.id, { members: [...f.members, email.trim().toLowerCase()] });
}
export async function removeMember(f: Family, email: string) {
  await updateFamily(f.id, { members: f.members.filter((m) => m !== email) });
}
function useCol<T>(name: string): T[] {
  useTick();
  return db[name].map((r) => ({ ...r })) as T[];
}
export const useItems = (_f: string | null) => useCol<Item>("items");
export const useStaples = (_f: string | null) => useCol<Staple>("staples");
export const useCoupons = (_f: string | null) => useCol<Coupon>("coupons");
const upd = (name: string, id: string, data: object) => {
  db[name] = db[name].map((r) => (r.id === id ? { ...r, ...data } : r));
  emit();
};
const del = (name: string, id: string) => {
  db[name] = db[name].filter((r) => r.id !== id);
  emit();
};
export async function addItem(_f: string, by: string, d: Partial<Item> & { name: string }) {
  db.items.push({ id: `i${n++}`, qty: "", note: "", store: "", stapleId: null, productId: null, ...d, done: false, addedBy: by });
  emit();
}
export const updateItem = async (_f: string, id: string, d: Partial<Item>) => upd("items", id, d);
export const deleteItem = async (_f: string, id: string) => del("items", id);
export async function toggleBought(_f: string, it: Item) {
  upd("items", it.id, { done: !it.done, doneAt: !it.done ? todayIso() : null });
  if (!it.done && it.stapleId) {
    const s = db.staples.find((x) => x.id === it.stapleId) as Staple | undefined;
    if (s && !s.history.includes(todayIso())) upd("staples", s.id, { history: [...s.history, todayIso()] });
  }
}
export async function clearBought(_f: string, items: Item[]) {
  items.filter((i) => i.done).forEach((i) => del("items", i.id));
}
export async function addStaple(_f: string, d: Partial<Staple> & { name: string }) {
  const id = `s${n++}`;
  db.staples.push({ id, category: "", store: "", productId: null, intervalDays: null, history: [], paused: false, ...d });
  emit();
  return id;
}
export const updateStaple = async (_f: string, id: string, d: Partial<Staple>) => upd("staples", id, d);
export const deleteStaple = async (_f: string, id: string) => del("staples", id);
export const findStapleByName = (s: Staple[], name: string) => s.find((x) => norm(x.name) === norm(name));
export async function addCoupon(_f: string, d: Omit<Coupon, "id" | "used">) {
  db.coupons.push({ id: `c${n++}`, ...d, used: false });
  emit();
}
export const updateCoupon = async (_f: string, id: string, d: Partial<Coupon>) => upd("coupons", id, d);
export const deleteCoupon = async (_f: string, id: string) => del("coupons", id);
export const useRows = <T,>(_f: string | null, name: string) => useCol<T>(name);
export async function addRow(_f: string, name: string, d: object) {
  const id = `r${n++}`;
  db[name].push({ id, ...d });
  emit();
  return id;
}
export const updateRow = async (_f: string, name: string, id: string, d: object) => upd(name, id, d);
export const deleteRow = async (_f: string, name: string, id: string) => del(name, id);
export async function addRows(_f: string, name: string, rows: object[]) {
  for (const r of rows) db[name].push({ id: `r${n++}`, ...r });
  emit();
}
export async function exportFamily(f: Family) {
  return { format: "kupnja/1", family: f, ...db };
}
