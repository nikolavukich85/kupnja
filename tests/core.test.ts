import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateInterval, dueState, intervalLabel } from "../src/lib/recurring";
import { norm, matchScore } from "../src/lib/text";
import { setPriceDataForTests, compareBasket, searchProducts, discount, isDeal, allDeals, cheapest, type PriceData } from "../src/lib/prices";

test("procjena ponavljanja", () => {
  assert.equal(estimateInterval([], 7), 7);
  assert.equal(estimateInterval(["2026-10-01"], null), null);
  assert.equal(estimateInterval(["2026-10-01", "2026-10-08"], null), 7);
  assert.equal(estimateInterval(["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-29"], 30), 7, "medijan, ne ručni");
  assert.equal(estimateInterval(["2026-10-01", "2026-10-01", "2026-10-08", "2026-10-15"], null), 7, "isti dan se ne broji dvaput");
  const s = dueState(["2026-10-01", "2026-10-08", "2026-10-15"], null, "2026-10-21");
  assert.equal(s.interval, 7);
  assert.equal(s.daysLeft, 1);
  assert.equal(s.soon, true);
  assert.equal(dueState(["2026-10-01", "2026-10-08"], null, "2026-10-16").due, true);
  assert.equal(intervalLabel(14), "svakih 2 tjedna");
});

test("pretraga bez dijakritika", () => {
  assert.equal(norm("Čokoladni ĐUS"), "cokoladni dus");
  assert.ok(matchScore("Mlijeko trajno 2,8% Dukat", "dukat mlij") > 0);
  assert.equal(matchScore("Kava", "mlijeko"), 0);
});

const data: PriceData = {
  updated: "", date: "2026-11-05",
  chains: { lidl: { name: "Lidl", stores: 1, scope: "local", products: 2 }, tommy: { name: "Tommy", stores: 1, scope: "local", products: 2 } },
  products: [
    { id: "1", n: "Mlijeko 2,8%", b: "Dukat", q: "1", u: "L", k: "", c: { lidl: [1.29, 0.99, 1.19], tommy: [1.35, null, null] } },
    { id: "2", n: "Kava mljevena", b: "Barcaffe", q: "500", u: "g", k: "", c: { lidl: [5.99, null, null], tommy: [5.49, null, null] } },
    { id: "3", n: "Tjestenina", b: "", q: "500", u: "g", k: "", c: { tommy: [0.99, null, null] } },
  ],
};

test("cijene, akcije i košarica", () => {
  setPriceDataForTests(data);
  assert.ok(Math.abs(discount(data.products[0].c.lidl) - 0.2326) < 0.001);
  assert.equal(isDeal(data.products[1].c.lidl), false);
  assert.deepEqual(cheapest(data.products[0], ["lidl", "tommy"]), { chain: "lidl", price: 0.99 });
  assert.deepEqual(searchProducts(data, "kava", ["lidl"]).map((p) => p.id), ["2"]);
  const b = compareBasket(["1", "2", "3"], ["lidl", "tommy"]);
  assert.deepEqual(b[0], { chain: "tommy", total: 7.83, found: 3, missing: 0 });
  assert.deepEqual(b[1], { chain: "lidl", total: 6.98, found: 2, missing: 1 });
  assert.equal(allDeals(data, ["lidl", "tommy"]).length, 1);
});
