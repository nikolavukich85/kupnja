import csv, io, json, sys, urllib.request, zipfile, collections
csv.field_size_limit(10_000_000)
UA={"User-Agent":"kupnja-dijagnoza/1.0"}
arch=json.load(urllib.request.urlopen(urllib.request.Request("https://api.cijene.dev/v0/list",headers=UA)))["archives"]
print("arhivi:",[a["date"] for a in arch[:5]])
for a in arch[:2]:
    p="/tmp/a.zip"; urllib.request.urlretrieve(a["url"],p) if False else open(p,"wb").write(urllib.request.urlopen(urllib.request.Request(a["url"],headers=UA)).read())
    zf=zipfile.ZipFile(p)
    print("=====",a["date"])
    for ch in ["lidl","tommy","eurospin"]:
        def rd(n):
            m=[x for x in zf.namelist() if x.endswith(f"{ch}/{n}")]
            return list(csv.DictReader(io.TextIOWrapper(zf.open(m[0]),encoding="utf-8"))) if m else []
        st=rd("stores.csv"); ids={s["store_id"] for s in st if "zadar" in s.get("city","").lower()} or {s["store_id"] for s in st}
        rows=[r for r in rd("prices.csv") if r["store_id"] in ids]
        f=lambda v: float(v.replace(",",".")) if v and v.strip() not in ("","0") else None
        c=collections.Counter()
        samp=[]
        for r in rows:
            pr,sp,b30,anc=f(r.get("price")),f(r.get("special_price")),f(r.get("best_price_30")),f(r.get("anchor_price") or "")
            c["redova"]+=1
            if sp: c["special_price"]+=1
            if sp and pr and sp<pr*0.95: c["special<price-5%"]+=1
            if pr and b30:
                if pr<b30*0.95: c["price<best30-5%"]+=1
                elif pr>b30*1.05: c["price>best30+5%"]+=1
                else: c["price~best30"]+=1
            if anc: c["anchor"]+=1
            if anc and pr and pr<anc*0.95: c["price<anchor-5%"]+=1
            if r.get("special_sale_type"): c["sale_type"]+=1
            if len(samp)<4 and (sp or (pr and b30 and abs(pr-b30)>0.01)): samp.append({k:v for k,v in r.items() if v})
        print(ch, "poslovnice", len(ids), "stupci", list(rows[0].keys()) if rows else None)
        print("  ", dict(c))
        for s in samp: print("   primjer", s)
