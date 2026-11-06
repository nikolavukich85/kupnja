import { test } from "node:test";
import assert from "node:assert/strict";
import { billsFor, dueCount, monthLabel, parseAmount, shiftMonth, summarize, STARTER_BILLS, type Bill, type Entry } from "../src/lib/money";

test("iznosi", () => {
  assert.equal(parseAmount("23,50"), 23.5);
  assert.equal(parseAmount("1.250,00"), 1250);
  assert.equal(parseAmount("1.250"), 1250);
  assert.equal(parseAmount("12.5"), 12.5);
  assert.equal(parseAmount("1 450 €"), 1450);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("-5"), null);
});

test("mjeseci", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(monthLabel("2026-11"), "Studeni 2026.");
});

const e = (type: "in" | "out", amount: number, category: string, date: string): Entry => ({ id: date + amount, type, amount, category, note: "", date, by: "a", billId: null });

test("pregled mjeseca", () => {
  const s = summarize([e("in", 1450, "placa", "2026-11-05"), e("out", 63.4, "hrana", "2026-11-06"), e("out", 20.1, "hrana", "2026-11-07"), e("out", 100, "kuca", "2026-10-30")], "2026-11");
  assert.equal(s.inSum, 1450);
  assert.equal(s.outSum, 83.5);
  assert.equal(s.left, 1366.5);
  assert.deepEqual(s.byCat.map((c) => c.cat.id), ["hrana"]);
});

const b = (id: string, day: number | null, paid: string[] = []): Bill => ({ id, name: id, amount: null, day, category: "kuca", paid, active: true, order: 0 });

test("obveze", () => {
  const st = billsFor([b("a", 10), b("b", 31), b("c", null), b("d", 5, ["2026-11"])], "2026-11", "2026-11-12");
  assert.deepEqual(st.map((x) => x.bill.id), ["c", "a", "b", "d"]);
  assert.equal(st[1].late, true);
  assert.equal(st[2].dueDay, 30, "zadnji dan studenog");
  assert.equal(st[2].late, false);
  assert.equal(st[3].paid, true);
  assert.equal(dueCount([b("a", 10), b("b", 31), b("c", null)], "2026-11-12"), 1);
  assert.equal(STARTER_BILLS.filter((x) => x.name.startsWith("Smart Lift")).length, 4);
});
