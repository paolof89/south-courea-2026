# Corea 2026 — Itinerario

Sito statico mobile-first e installabile come PWA per consultare l'itinerario
del viaggio in Corea del Sud dal **26 luglio al 13 agosto 2026**.

Nessun framework, nessun backend, nessuna dipendenza esterna. Vedi
[SPEC.md](SPEC.md) per la specifica tecnica completa.

## Stato attuale (primo incremento)

- [x] Struttura HTML/CSS/JS vanilla
- [x] Home con tutte le 19 giornate (26/07 – 13/08 2026)
- [x] Dettaglio funzionante per il 26/07 (esempio dalla specifica)
- [x] Hash routing (`#/` e `#/day/YYYY-MM-DD`)
- [x] Navigazione precedente / indice / successivo
- [x] Link Google Maps generati da query testuali
- [x] Web App Manifest (icone da aggiungere in un incremento successivo)
- [x] Service Worker con app shell in cache e fallback offline
- [ ] Icone PWA 192/512 e maskable
- [ ] Dettagli giornalieri 27/07 – 08/08 (trascrizione da importare)
- [ ] "Vai a oggi", tappe completate, tema scuro, filtri (fuori scope di
      questo incremento)

I giorni per cui non sono ancora disponibili i dettagli sono marcati come
`placeholder` e la vista di dettaglio mostra un avviso esplicito. **Nessun
dato è inventato.**

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
3. In DevTools attiva **Network → Offline** e ricarica: la home e la
   giornata già visitata devono restare consultabili.

## Struttura

```
.
├── index.html              # Shell dell'applicazione
├── manifest.webmanifest    # Manifest PWA
├── sw.js                   # Service Worker (cache app shell + dati)
├── assets/
│   ├── css/app.css         # Stile mobile-first
│   └── js/app.js           # Modulo ES: router + rendering
├── data/
│   └── itinerary.json      # Contenuto dell'itinerario
├── SPEC.md                 # Specifica tecnica
└── README.md
```

Tutti i percorsi nel codice sono **relativi** (`./…`), quindi il sito
funziona sia in locale sia pubblicato in una sottocartella su GitHub Pages.

## Modificare l'itinerario

L'unica fonte dati è [`data/itinerary.json`](data/itinerary.json).

- Aggiorna la data in `trip.lastUpdated` a ogni modifica sostanziale.
- Per completare un giorno oggi `placeholder`: cambia `detailStatus` in
  `"transcribed"` (o `"confirmed"` dopo la verifica) e popola l'array
  `items` seguendo la struttura del giorno **26/07** e le regole della
  SPEC §6.
- Non inventare informazioni mancanti: se un dato è dubbio, imposta
  `status: "uncertain"` sull'elemento.
- Dopo la modifica, verifica che il JSON sia valido:

  ```powershell
  node -e "JSON.parse(require('fs').readFileSync('data/itinerary.json','utf8'))"
  ```

## Pubblicazione su GitHub Pages

1. Push su `main`.
2. **Settings → Pages → Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: `main` — Cartella: `/ (root)`
3. Attendere la pubblicazione, poi verificare che l'URL della forma
   `https://<account>.github.io/<repo>/` carichi la home, i CSS/JS
   e registri correttamente il Service Worker.

Poiché tutti i percorsi sono relativi, non è richiesta alcuna
configurazione aggiuntiva né un file di base path.

## Aggiornare la cache del Service Worker

Quando pubblichi una versione con modifiche a shell o codice, incrementa
la costante `CACHE_NAME` in [`sw.js`](sw.js) (es. `korea-2026-v1` →
`korea-2026-v2`). All'attivazione, il nuovo Service Worker eliminerà
automaticamente le vecchie cache applicative.

## Privacy

Nessun dato personale, nessuna credenziale, nessun codice di prenotazione
è memorizzato nel repository o nel sito. Il sito non usa analytics e non
invia dati a servizi esterni. Vedi SPEC §14 per i dati vietati.

