# Kupnja

Obiteljska aplikacija za kupnju: zajednički popis (uživo za sve članove), stalni artikli koji
uče koliko često se kupuju, akcije iz službenih cjenika trgovina i kuponi s rokom.

- Radi u pregledniku na Androidu i iPhoneu; „Dodaj na početni zaslon“ za ikonu.
- Prijava Google računom; članovi obitelji se dodaju u Postavkama.
- Podaci: Firebase Firestore (besplatni plan), rade i bez interneta.
- Cijene: javni dnevni arhiv cjenika (cijene.dev, Odluka NN 75/2025) – Lidl, Tommy, Eurospin,
  poslovnice u Zadru. Müller nema strojno čitljiv cjenik.
  GitHub Actions ih preuzima svako jutro (`scripts/prices.py`) i ponovno objavljuje stranicu.

## Promjene
- Trgovine: u aplikaciji (Postavke). Novi lanac s cijenama: dodati u `CHAINS` u `scripts/prices.py`.
- Grad za cijene: `CITIES` u `scripts/prices.py`.

## Razvoj
```
npm install
npm run dev -- --mode mock   # sučelje s probnim podacima, bez Firebasea
npm test
npm run build
```
