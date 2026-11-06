import json, os, subprocess, sys, tempfile, zipfile

def make_zip(path):
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("2026-11-05/lidl/stores.csv", "store_id,type,address,city,zipcode\nL1,supermarket,Ulica 1,Zadar,23000\nL2,supermarket,Ulica 2,Split,21000\n")
        z.writestr("2026-11-05/lidl/products.csv", "product_id,barcode,name,brand,category,unit,quantity\n1,3850000000001,Mlijeko 2.8%,Dukat,Mlijeko,L,1\n2,lidl:2,Kava mljevena,Bellarom,Kava,g,500\n")
        z.writestr("2026-11-05/lidl/prices.csv",
            "store_id,product_id,price,unit_price,best_price_30,anchor_price,special_price,available,special_sale_type,anchor_price_date\n"
            "L1,1,1.29,,1.19,,0.99,1,akcija,\nL2,1,1.10,,,,,1,,\nL1,2,4.99,,,,,1,,\n")
        z.writestr("2026-11-05/tommy/stores.csv", "store_id,type,address,city,zipcode\nT1,supermarket,A,ZADAR,23000\n")
        z.writestr("2026-11-05/tommy/products.csv", "product_id,barcode,name,brand,category,unit,quantity\n9,3850000000001,MLIJEKO TRAJNO 2,8%,DUKAT,,L,1\n")
        z.writestr("2026-11-05/tommy/prices.csv", "store_id,product_id,price,unit_price,best_price_30,anchor_price,special_price\nT1,9,1.35,,1.59,,\n")
        z.writestr("2026-11-05/eurospin/stores.csv", "store_id,type,address,city,zipcode\nE1,supermarket,B,Rijeka,51000\n")
        z.writestr("2026-11-05/eurospin/products.csv", "product_id,barcode,name,brand,category,unit,quantity\n5,,Tjestenina,,,g,500\n")
        z.writestr("2026-11-05/eurospin/prices.csv", "store_id,product_id,price,unit_price,best_price_30,anchor_price,special_price\nE1,5,0.79,,,,\n")

with tempfile.TemporaryDirectory() as d:
    zp, out = os.path.join(d, "a.zip"), os.path.join(d, "o", "p.json")
    make_zip(zp)
    subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "..", "scripts", "prices.py"), out, "--zip", zp], check=True)
    data = json.load(open(out))
    by = {p["id"]: p for p in data["products"]}
    milk = by["3850000000001"]
    assert milk["c"]["lidl"] == [1.29, 0.99, 1.19, "akcija"], milk     # samo Zadar, Split ignoriran
    assert milk["c"]["tommy"] == [1.59, 1.35, 1.59], milk               # isti barkod spojen; akcija prepoznata iz best_price_30
    assert by["lidl:2"]["c"]["lidl"][0] == 4.99
    assert data["chains"]["eurospin"]["scope"] == "all"                 # nema Zadra -> sve poslovnice
    assert data["chains"]["lidl"]["stores"] == 1
    print("OK", len(data["products"]), "proizvoda")
