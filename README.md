# My Trips — Itinerari di viaggio

Sito statico mobile-first e installabile come PWA per consultare gli
itinerari dei miei viaggi, offline compreso. Copre più viaggi: si parte da
una pagina "I miei viaggi" per scegliere quale itinerario consultare.

Nessun framework, nessun backend, nessuna dipendenza esterna. Vedi
[SPEC.md](SPEC.md) per la specifica tecnica completa.

## Viaggi disponibili

- **Corea 2026** (26 luglio – 13 agosto 2026) — `data/trips/korea-2026.json`
- **Cina 2025** (19 agosto – 7 settembre 2025) — `data/trips/china-2025.json`

## Stato attuale

- [x] Struttura HTML/CSS/JS vanilla
- [x] Home = selettore dei viaggi (`#/`), con card per ogni viaggio
- [x] Home per viaggio (`#/trip/:id`) con l'elenco delle giornate
- [x] Dettaglio giornata (`#/trip/:id/day/YYYY-MM-DD`)
- [x] Hash routing a 3 livelli
- [x] Navigazione precedente / indice / successivo, scoped al viaggio aperto
- [x] Link Google Maps generati da query testuali
- [x] Web App Manifest (icone da aggiungere in un incremento successivo)
- [x] Service Worker con app shell e dati di tutti i viaggi in cache
- [x] Tappe completate salvate per viaggio (namespace separato in
      `localStorage`), tema condiviso tra i viaggi
- [ ] Icone PWA 192/512 e maskable
- [ ] "Vai a oggi" cross-trip, filtri sul selettore viaggi (fuori scope di
      questo incremento)

**Nessun dato è inventato.** I giorni per cui non sono ancora disponibili i
dettagli sono marcati come `placeholder` e la vista di dettaglio mostra un
avviso esplicito.


## Avvio locale

Il sito è composto da file statici, ma un **server locale è necessario**
perché il Service Worker e `fetch()` non funzionano dal filesystem (`file://`).

Scegli uno dei metodi seguenti dalla root del progetto.

### Python 3

```powershell
python -m http.server 8080
```

Apri <http://localhost:8080/>.

### Node.js (senza installazione permanente)

```powershell
npx --yes serve -l 8080 .
```

Apri <http://localhost:8080/>.

### VS Code — estensione "Live Server"

1. Installa l'estensione **Live Server** (Ritwick Dey).
2. Clic destro su `index.html` → **Open with Live Server**.

### Verifica offline

1. Carica il sito almeno una volta online.
2. In DevTools apri **Application → Service Workers** e conferma che
   `sw.js` sia attivo.
3. In DevTools attiva **Network → Offline** e ricarica: il selettore dei
   viaggi e le giornate già visitate devono restare consultabili.

## Struttura

```
.
├── index.html              # Shell dell'applicazione
├── manifest.webmanifest    # Manifest PWA
├── sw.js                   # Service Worker (cache app shell + dati)
├── assets/
│   ├── css/app.css         # Stile mobile-first
│   └── js/
│       ├── app.js          # Modulo ES: router + rendering
│       └── storage.js      # localStorage (tappe completate per viaggio, tema)
├── data/
│   └── trips/
│       ├── index.json      # Elenco dei viaggi (id, title, date, dataUrl)
│       ├── korea-2026.json # Itinerario Corea 2026
│       └── china-2025.json # Itinerario Cina 2025
├── SPEC.md                 # Specifica tecnica
└── README.md
```

Tutti i percorsi nel codice sono **relativi** (`./…`), quindi il sito
funziona sia in locale sia pubblicato in una sottocartella su GitHub Pages.

## Modificare un itinerario o aggiungerne uno nuovo

La fonte dati è [`data/trips/index.json`](data/trips/index.json) (elenco dei
viaggi) più un file `data/trips/<id>.json` per ciascun viaggio.

- Per modificare un viaggio esistente: apri il suo `data/trips/<id>.json`.
  - Aggiorna la data in `trip.lastUpdated` a ogni modifica sostanziale.
  - Per completare un giorno oggi `placeholder`: cambia `detailStatus` in
    `"transcribed"` (o `"confirmed"` dopo la verifica) e popola l'array
    `items` seguendo la SPEC §6.
  - Non inventare informazioni mancanti: se un dato è dubbio, imposta
    `status: "uncertain"` sull'elemento.
- Per aggiungere un nuovo viaggio:
  1. Crea `data/trips/<id>.json` (stessa struttura degli altri viaggi,
     `trip.id` uguale a `<id>`).
  2. Aggiungi una voce in `data/trips/index.json` con `id`, `title`,
     `startDate`, `endDate`, `summary` e `dataUrl`.
  3. Aggiungi il percorso del nuovo file all'array `APP_SHELL` in
     [`sw.js`](sw.js) così resta disponibile offline dal primo avvio, e
     incrementa `CACHE_NAME` (vedi sotto).
- Vedi anche
  [.github/instructions/itinerary-data.instructions.md](.github/instructions/itinerary-data.instructions.md)
  per le regole complete campo per campo.
- Dopo ogni modifica, verifica che il JSON sia valido:

  ```powershell
  Get-Content -Raw data/trips/<id>.json | ConvertFrom-Json
  Get-Content -Raw data/trips/index.json | ConvertFrom-Json
  ```

## Pubblicazione su GitHub Pages

1. Push su `main`.
2. **Settings → Pages → Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: `main` — Cartella: `/ (root)`
3. Attendere la pubblicazione, poi verificare che l'URL della forma
   `https://<account>.github.io/<repo>/` carichi il selettore dei viaggi,
   i CSS/JS e registri correttamente il Service Worker.

Poiché tutti i percorsi sono relativi, non è richiesta alcuna
configurazione aggiuntiva né un file di base path.

> **Nota sul rename del repository:** questo repository sta per essere
> rinominato da `south-courea-2026` a `my-travel-log` (non è più solo un
> viaggio in Corea). Dopo il rename su GitHub (Settings → repository name),
> GitHub reindirizza automaticamente l'URL delle Pages precedente per un
> periodo di transizione; aggiorna comunque eventuali bookmark e il remote
> `git` locale con `git remote set-url origin <nuovo-url>`.

## Aggiornare la cache del Service Worker

Quando pubblichi una versione con modifiche a shell, codice o dati di un
viaggio, incrementa la costante `CACHE_NAME` in [`sw.js`](sw.js) (es.
`my-travel-log-v1` → `my-travel-log-v2`). Senza questo incremento il file
`sw.js` resta identico e i visitatori non riceveranno mai l'aggiornamento.
Il nuovo Service Worker si attiva **automaticamente** (nessun banner con
pulsante da premere): l'app ricontrolla la presenza di aggiornamenti alla
registrazione, ogni volta che torna in primo piano e periodicamente mentre
resta aperta, quindi raggiunge anche i visitatori che non interagiscono con
alcun avviso.

## Privacy

Nessun dato personale, nessuna credenziale, nessun codice di prenotazione
è memorizzato nel repository o nel sito. Il sito non usa analytics e non
invia dati a servizi esterni. Vedi SPEC §14 per i dati vietati.

