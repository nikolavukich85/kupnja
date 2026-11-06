import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { firebaseConfig } from "../firebase-config";
import { norm, todayIso } from "./text";

/**
 * Zajednički podaci obitelji u Firebase Firestoreu.
 * Promjene se kod svih članova vide odmah, a bez interneta se spremaju na
 * uređaju i pošalju kad se veza vrati.
 */

export const configured = !!firebaseConfig.apiKey;
const app = configured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const fs = app
  ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  : null;

// ---------- Tipovi ----------

export type Store = { id: string; name: string; chain: string | null };

export type Family = { id: string; name: string; members: string[]; stores: Store[] };

export type Item = {
  id: string;
  name: string;
  qty: string;
  note: string;
  store: string; // id trgovine ili ""
  stapleId: string | null;
  productId: string | null;
  done: boolean;
  addedBy: string;
  createdAt?: { seconds: number } | null;
  doneAt?: string | null;
};

export type Staple = {
  id: string;
  name: string;
  category: string;
  store: string;
  productId: string | null;
  intervalDays: number | null;
  history: string[];
  paused: boolean;
};

export type Coupon = {
  id: string;
  store: string;
  title: string;
  code: string;
  value: string;
  validUntil: string; // GGGG-MM-DD ili ""
  image: string; // data URL (smanjena slika) ili ""
  used: boolean;
};

export const DEFAULT_STORES: Store[] = [
  { id: "eurospin", name: "Eurospin", chain: "eurospin" },
  { id: "lidl", name: "Lidl", chain: "lidl" },
  { id: "mueller", name: "Müller", chain: null },
  { id: "tommy", name: "Tommy", chain: "tommy" },
];

// ---------- Prijava ----------

export function useUser(): { user: User | null; ready: boolean } {
  const [state, setState] = useState<{ user: User | null; ready: boolean }>({ user: auth?.currentUser ?? null, ready: !auth });
  useEffect(() => (auth ? onAuthStateChanged(auth, (u) => setState({ user: u, ready: true })) : undefined), []);
  return state;
}

export async function signIn() {
  if (!auth) throw new Error("Aplikacija još nije povezana s Firebaseom.");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    // Kad preglednik blokira prozor (npr. aplikacija na početnom zaslonu), prijava ide preusmjeravanjem.
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") await signInWithRedirect(auth, provider);
    else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") throw e;
  }
}

export const signOut = () => (auth ? fbSignOut(auth) : Promise.resolve());

// ---------- Obitelj ----------

const fam = (id: string) => doc(fs!, "families", id);
const sub = (fid: string, name: string) => collection(fs!, "families", fid, name);

export function useFamily(email: string | null): { family: Family | null; loading: boolean } {
  const [state, setState] = useState<{ family: Family | null; loading: boolean }>({ family: null, loading: true });
  useEffect(() => {
    if (!fs || !email) {
      setState({ family: null, loading: false });
      return;
    }
    const q = query(collection(fs, "families"), where("members", "array-contains", email.toLowerCase()), limit(1));
    return onSnapshot(
      q,
      (snap) => {
        const d = snap.docs[0];
        setState({ family: d ? ({ id: d.id, ...(d.data() as Omit<Family, "id">) } as Family) : null, loading: false });
      },
      () => setState({ family: null, loading: false })
    );
  }, [email]);
  return state;
}

export async function createFamily(email: string, name: string) {
  const ref = doc(collection(fs!, "families"));
  await setDoc(ref, { name: name.trim() || "Naša obitelj", members: [email.toLowerCase()], stores: DEFAULT_STORES, createdAt: serverTimestamp() });
  return ref.id;
}

export const updateFamily = (fid: string, data: Partial<Omit<Family, "id">>) => updateDoc(fam(fid), data);

export async function addMember(f: Family, email: string) {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("Upiši ispravnu e-mail adresu.");
  if (f.members.includes(e)) return;
  await updateDoc(fam(f.id), { members: arrayUnion(e) });
}

export async function removeMember(f: Family, email: string) {
  if (f.members.length <= 1) throw new Error("Obitelj mora imati barem jednog člana.");
  await updateDoc(fam(f.id), { members: f.members.filter((m) => m !== email) });
}

// ---------- Žive kolekcije ----------

function useCollection<T>(fid: string | null, name: string, order?: string): T[] | null {
  const [rows, setRows] = useState<T[] | null>(null);
  useEffect(() => {
    if (!fs || !fid) return;
    const q = order ? query(sub(fid, name), orderBy(order)) : sub(fid, name);
    // Odmah nakon izrade obitelji poslužitelj može nakratko odbiti čitanje; tada pokušaj ponovno.
    let stop = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const listen = () => {
      stop = onSnapshot(
        q,
        { includeMetadataChanges: false },
        (snap) => {
          tries = 0;
          setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        },
        () => {
          if (tries++ < 10) timer = setTimeout(listen, 1500);
        }
      );
    };
    listen();
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [fid, name, order]);
  return rows;
}

export const useItems = (fid: string | null) => useCollection<Item>(fid, "items");
export const useStaples = (fid: string | null) => useCollection<Staple>(fid, "staples");
export const useCoupons = (fid: string | null) => useCollection<Coupon>(fid, "coupons");

// ---------- Popis ----------

export async function addItem(fid: string, by: string, data: Partial<Item> & { name: string }) {
  const name = data.name.trim();
  if (!name) return;
  await addDoc(sub(fid, "items"), {
    name,
    qty: data.qty?.trim() ?? "",
    note: data.note?.trim() ?? "",
    store: data.store ?? "",
    stapleId: data.stapleId ?? null,
    productId: data.productId ?? null,
    done: false,
    addedBy: by,
    createdAt: serverTimestamp(),
    doneAt: null,
  });
}

export const updateItem = (fid: string, id: string, data: Partial<Item>) => updateDoc(doc(fs!, "families", fid, "items", id), data);
export const deleteItem = (fid: string, id: string) => deleteDoc(doc(fs!, "families", fid, "items", id));

/** Kupljeno: stavka se označi, a kod stalnog artikla zapiše se datum (za učenje ponavljanja). */
export async function toggleBought(fid: string, item: Item) {
  const done = !item.done;
  const b = writeBatch(fs!);
  b.update(doc(fs!, "families", fid, "items", item.id), { done, doneAt: done ? todayIso() : null });
  if (done && item.stapleId) b.update(doc(fs!, "families", fid, "staples", item.stapleId), { history: arrayUnion(todayIso()) });
  await b.commit();
}

export async function clearBought(fid: string, items: Item[]) {
  const b = writeBatch(fs!);
  for (const it of items.filter((i) => i.done)) b.delete(doc(fs!, "families", fid, "items", it.id));
  await b.commit();
}

// ---------- Stalni artikli ----------

export async function addStaple(fid: string, data: Partial<Staple> & { name: string }) {
  const ref = await addDoc(sub(fid, "staples"), {
    name: data.name.trim(),
    category: data.category?.trim() ?? "",
    store: data.store ?? "",
    productId: data.productId ?? null,
    intervalDays: data.intervalDays ?? null,
    history: data.history ?? [],
    paused: false,
  });
  return ref.id;
}

export const updateStaple = (fid: string, id: string, data: Partial<Staple>) => updateDoc(doc(fs!, "families", fid, "staples", id), data);
export const deleteStaple = (fid: string, id: string) => deleteDoc(doc(fs!, "families", fid, "staples", id));

export function findStapleByName(staples: Staple[], name: string): Staple | undefined {
  const n = norm(name);
  return staples.find((s) => norm(s.name) === n);
}

// ---------- Kuponi ----------

export async function addCoupon(fid: string, data: Omit<Coupon, "id" | "used">) {
  await addDoc(sub(fid, "coupons"), { ...data, used: false });
}
export const updateCoupon = (fid: string, id: string, data: Partial<Coupon>) => updateDoc(doc(fs!, "families", fid, "coupons", id), data);
export const deleteCoupon = (fid: string, id: string) => deleteDoc(doc(fs!, "families", fid, "coupons", id));

// ---------- Općenito (koristi ga i dio „Novac") ----------

export const useRows = <T,>(fid: string | null, name: string) => useCollection<T>(fid, name);
export async function addRow(fid: string, name: string, data: object) {
  const ref = await addDoc(sub(fid, name), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}
export const updateRow = (fid: string, name: string, id: string, data: object) => updateDoc(doc(fs!, "families", fid, name, id), data);
export const deleteRow = (fid: string, name: string, id: string) => deleteDoc(doc(fs!, "families", fid, name, id));
export async function addRows(fid: string, name: string, rows: object[]) {
  const b = writeBatch(fs!);
  for (const r of rows) b.set(doc(sub(fid, name)), { ...r, createdAt: serverTimestamp() });
  await b.commit();
}

/** Izvoz svih podataka obitelji (sigurnosna kopija). */
export async function exportFamily(f: Family) {
  const out: Record<string, unknown> = { format: "kupnja/1", exportedAt: new Date().toISOString(), family: f };
  for (const name of ["items", "staples", "coupons", "money", "bills"]) out[name] = (await getDocs(sub(f.id, name))).docs.map((d) => ({ id: d.id, ...d.data() }));
  return out;
}
