#!/usr/bin/env python3
"""
Dnevne cijene za aplikaciju Kupnja.

Preuzima javni dnevni arhiv cjenika (https://cijene.dev, podaci temeljem
Odluke o objavi cjenika, NN 75/2025), izdvaja odabrane trgovačke lance i
poslovnice u odabranim gradovima te zapisuje kompaktnu JSON datoteku.

Upotreba:
  python scripts/prices.py public/data/prices.json            # preuzmi najnoviji arhiv
  python scripts/prices.py out.json --zip lokalni.zip          # obradi lokalni arhiv
Samo standardna biblioteka; radi na GitHub Actions bez instalacije.
"""
import argparse
import csv
import io
import json
import os
import statistics
import sys
import tempfile
import unicodedata
import urllib.request
import zipfile
from datetime import datetime, timezone

LIST_URL = "https://api.cijene.dev/v0/list"
CHAINS = {"lidl": "Lidl", "tommy": "Tommy", "eurospin": "Eurospin"}
CITIES = ["zadar"]  # poslovnice u ovim gradovima; ako ih lanac nema, uzimaju se sve
UA = {"User-Agent": "kupnja-obiteljska-aplikacija/1.0"}

csv.field_size_limit(10_000_000)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn").replace("đ", "d").strip()


def num(v):
    try:
        x = float(str(v).replace(",", "."))
        return round(x, 2) if x > 0 else None
    except (TypeError, ValueError):
        return None


def download_latest(dest: str) -> str:
    with urllib.request.urlopen(urllib.request.Request(LIST_URL, headers=UA), timeout=60) as r:
        archives = json.load(r)["archives"]
    if not archives:
        raise SystemExit("Nema dostupnih arhiva.")
    latest = archives[0]
    print(f"Preuzimam {latest['url']} ({latest['size'] / 1e6:.0f} MB)", file=sys.stderr)
    with urllib.request.urlopen(urllib.request.Request(latest["url"], headers=UA), timeout=600) as r, open(dest, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    return latest["date"]


def read_csv(zf: zipfile.ZipFile, chain: str, name: str):
    match = [n for n in zf.namelist() if n.endswith(f"{chain}/{name}")]
    if not match:
        return None
    with zf.open(match[0]) as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))


def process(zip_path: str, date: str | None) -> dict:
    out = {"updated": datetime.now(timezone.utc).isoformat(timespec="minutes"), "date": date, "chains": {}, "products": []}
    merged: dict[str, dict] = {}
    with zipfile.ZipFile(zip_path) as zf:
        for code, label in CHAINS.items():
            stores = list(read_csv(zf, code, "stores.csv") or [])
            if not stores:
                print(f"{label}: nema podataka u arhivu", file=sys.stderr)
                continue
            local = {s["store_id"] for s in stores if any(c in norm(s.get("city", "")) for c in CITIES)}
            scope = "local" if local else "all"
            ids = local or {s["store_id"] for s in stores}
            per: dict[str, dict] = {}
            for p in read_csv(zf, code, "prices.csv"):
                if p["store_id"] not in ids or p.get("available") == "0":
                    continue
                price, special, best30 = num(p.get("price")), num(p.get("special_price")), num(p.get("best_price_30"))
                if price is None and special is None:
                    continue
                d = per.setdefault(p["product_id"], {"prices": [], "special": [], "best30": [], "sale": ""})
                if price is not None:
                    d["prices"].append(price)
                if special is not None:
                    d["special"].append(special)
                if best30 is not None:
                    d["best30"].append(best30)
                if p.get("special_sale_type"):
                    d["sale"] = p["special_sale_type"][:40]
            count = 0
            for prod in read_csv(zf, code, "products.csv"):
                d = per.get(prod["product_id"])
                if not d:
                    continue
                regular = round(statistics.median(d["prices"]), 2) if d["prices"] else None
                special = min(d["special"]) if d["special"] else None
                if special is not None and regular is not None and special >= regular:
                    special = None
                best30 = min(d["best30"]) if d["best30"] else None
                barcode = (prod.get("barcode") or "").strip()
                key = barcode if barcode and ":" not in barcode else f"{code}:{prod['product_id']}"
                m = merged.setdefault(key, {
                    "id": key,
                    "n": (prod.get("name") or "").strip()[:120],
                    "b": (prod.get("brand") or "").strip()[:40],
                    "q": (prod.get("quantity") or "").strip()[:20],
                    "u": (prod.get("unit") or "").strip()[:10],
                    "k": (prod.get("category") or "").strip()[:40],
                    "c": {},
                })
                entry = [regular, special, best30]
                if d["sale"]:
                    entry.append(d["sale"])
                m["c"][code] = entry
                count += 1
            out["chains"][code] = {"name": label, "stores": len(ids), "scope": scope, "products": count}
            print(f"{label}: {len(ids)} poslovnica ({scope}), {count} proizvoda", file=sys.stderr)
    out["products"] = sorted(merged.values(), key=lambda m: norm(m["n"]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("output")
    ap.add_argument("--zip")
    a = ap.parse_args()
    if a.zip:
        data = process(a.zip, None)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "arhiv.zip")
            date = download_latest(path)
            data = process(path, date)
    if not data["products"]:
        raise SystemExit("Nijedan proizvod nije obrađen - ne prepisujem postojeće cijene.")
    os.makedirs(os.path.dirname(os.path.abspath(a.output)), exist_ok=True)
    tmp = a.output + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, a.output)
    print(f"Zapisano {len(data['products'])} proizvoda u {a.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
