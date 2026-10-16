# Bestellingen – Voorraadtelling Grand Café

Eenvoudige web-app om op locatie (tablet/gsm) de voorraad te tellen en meteen
een bestellijst per leverancier te maken en door te sturen.

## Bestanden

| Bestand | Wat |
|---|---|
| `index.html` | De app. De productlijst en leveranciers staan in het blok `<script id="seed">`. |
| `platform.js` | Laat de app buiten claude.ai draaien: opslag, downloads, later Firebase. |
| `config.js` | Instellingen: gebruikers + pincodes, automatisch afmelden, later de Firebase-config. |
| `pin.js` | Aanmeldscherm met pincode. |
| `pincode-maken.html` | Hulppagina om een pincode-regel voor een nieuwe gebruiker te maken. |
| `.github/workflows/pages.yml` | Publiceert automatisch op GitHub Pages bij elke push naar `main`. |
| `firebase.json`, `firestore.rules`, `data/` | Klaar voor fase 2 (Firebase). |

## Fase 1 – online via GitHub Pages

1. Maak in de org **De-Hoorn** een nieuwe repo `bestellingen`.
2. Upload alle bestanden uit deze map (ook de verborgen map `.github` en `.nojekyll`),
   of push met git:
   ```bash
   git remote add origin https://github.com/De-Hoorn/bestellingen.git
   git push -u origin main
   ```
3. Repo → **Settings → Pages → Source: GitHub Actions**.
4. Na ±1 minuut staat de app op `https://de-hoorn.github.io/bestellingen/`.
5. Op de tablet: open de link → *Toevoegen aan beginscherm*.

In deze fase worden tellingen **per toestel** bewaard (localStorage). De
"vorige telling" en "Vorige tellingen" werken dus enkel op het toestel waarop
geteld werd. Gebruik voor het tellen best altijd dezelfde tablet.

> Let op: GitHub Pages op het gratis plan vereist een **publieke** repo. De
> productlijst en leveranciersinfo (minimumbedragen, leverdagen) zijn dan
> publiek leesbaar. Liever privé? Upgrade naar GitHub Team, of host via
> Firebase Hosting (zie fase 2) vanuit een privé-repo.

## Aanmelden met pincode

Elke gebruiker kiest zijn naam en tikt een pincode van 4 cijfers. Zijn naam komt
bij elke opgeslagen telling ("Vorige tellingen"). Na 30 minuten zonder
activiteit meldt de app automatisch af; een begonnen telling blijft bewaard.
Na 5 foute pogingen volgt een wachttijd die telkens langer wordt.

**Gebruiker toevoegen**

1. Open `https://de-hoorn.github.io/bestellingen/pincode-maken.html`.
2. Vul naam en pincode in → kopieer de regel.
3. Plak de regel in `config.js` onder `gebruikers` en push.

**Gebruiker verwijderen:** haal de regel uit `config.js` en push.

Voorlopig is er één vaste login: **user / 5555**. Later werken we de beveiliging verder uit zoals in Loftbeheer (persoonlijke login).

> Zolang er geen Firebase is, wordt de pincode in de browser gecontroleerd. Dat
> houdt toevallige gebruikers buiten en zet een naam bij elke telling, maar het
> is geen echte beveiliging: iemand met technische kennis kan de pagina
> zonder pincode openen of een pincode van 4 cijfers raden. Echte bescherming
> komt met Firebase Auth (fase 2).

## Productlijst aanpassen

Pas het `seed`-blok in `index.html` aan (product, leverancier, eenheid,
bestelpunt, hoeveelheid, locatie) en push. Pages publiceert automatisch.

## Fase 2 – Firebase (gedeelde database)

Nodig zodra tellingen tussen toestellen gedeeld moeten worden.

1. Firebase console → nieuw project (of bestaand De Hoorn-project) → **Firestore** aanzetten.
2. Web app toevoegen → kopieer de config naar `config.js` (`firebase: {...}`).
3. Productlijst inladen: maak in Firestore de documenten `config/producten`
   en `config/leveranciers` met de inhoud van `data/config-producten.json` en
   `data/config-leveranciers.json`. (Zolang die ontbreken, gebruikt de app de lijst uit `index.html`.)
4. Regels publiceren: `firebase deploy --only firestore:rules`.
5. Optioneel hosting ook naar Firebase: `firebase deploy --only hosting`.

De app-code zelf hoeft niet te veranderen: `platform.js` schakelt automatisch
van lokale opslag naar Firestore. Koppel dan de pincode aan **Firebase Auth** (bv. via een Cloud Function die de pincode
controleert en een token teruggeeft) en verstreng de regels in `firestore.rules`
zodat enkel aangemelde gebruikers kunnen lezen en schrijven.
