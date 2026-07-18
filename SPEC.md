# Specifica tecnica — Sito mobile “My Trips” (multi-viaggio)

**Versione:** 1.0  
**Destinatari:** team di sviluppo  
**Obiettivo:** realizzare un sito statico, mobile-first e installabile, pubblicato inizialmente su GitHub Pages e facilmente migrabile in futuro a Cloudflare Pages.

---

## 1. Obiettivo del prodotto

Realizzare un’applicazione web leggera per consultare agevolmente l’itinerario durante il viaggio in Corea, anche in condizioni di connettività assente o instabile.

Il prodotto deve:

- essere ottimizzato per smartphone;
- funzionare senza backend e senza database;
- essere pubblicabile gratuitamente su GitHub Pages;
- essere installabile sulla schermata iniziale come PWA;
- rendere disponibile offline l’ultima versione dell’itinerario già aperta;
- consentire di raggiungere rapidamente la giornata corrente e le singole tappe;
- aprire ogni luogo in Google Maps o, se configurato, in Naver Map;
- non contenere dati sensibili, documenti, codici di prenotazione o credenziali;
- essere facilmente trasferibile su Cloudflare Pages senza modifiche sostanziali.

---

## 2. Scelte architetturali

### 2.1 Stack consigliato

Per la prima versione utilizzare:

- HTML5 semantico;
- CSS3 nativo;
- JavaScript ES modules, senza framework;
- file JSON statico per i dati dell’itinerario;
- Web App Manifest;
- Service Worker;
- GitHub Pages per l’hosting.

Non usare React, Next.js, database o servizi server-side per l’MVP. Per un’applicazione di sola consultazione aumenterebbero complessità, dipendenze e rischio operativo senza un beneficio concreto.

### 2.2 Principi

- **Static-first:** tutto il contenuto necessario deve essere contenuto nel repository.
- **Offline-first:** dopo il primo caricamento, le pagine essenziali devono essere consultabili offline.
- **Progressive enhancement:** il contenuto deve restare leggibile anche se JavaScript non viene eseguito; in alternativa prevedere un fallback HTML o un messaggio esplicito.
- **No lock-in:** evitare API o funzionalità specifiche di GitHub Pages.
- **Privacy by design:** nessun dato personale o segreto nel repository o nel sito.

---

## 3. Ambito MVP

### 3.1 Funzionalità obbligatorie

1. Home con itinerario generale dal 26 luglio al 13 agosto 2026.
2. Vista dettagliata per giornata.
3. Navigazione “Giorno precedente / Oggi / Giorno successivo”.
4. Indice delle giornate con città, data e trasferimenti principali.
5. Timeline ordinata per orario.
6. Per ogni tappa:
   - orario;
   - titolo;
   - categoria;
   - descrizione o nota;
   - durata prevista;
   - costo, se disponibile;
   - mezzo e durata dello spostamento dalla tappa precedente;
   - pulsante per aprire la posizione in una mappa.
7. Evidenza grafica differente per:
   - visita;
   - trasferimento;
   - mercato/shopping;
   - pasto;
   - hotel/check-in;
   - attività facoltativa.
8. Modalità offline tramite Service Worker.
9. Installabilità come PWA.
10. Memorizzazione locale delle tappe completate.
11. Pulsante per azzerare le tappe completate.
12. Tema chiaro con leggibilità elevata all’aperto.
13. Accessibilità da tastiera e compatibilità con screen reader.
14. Pagina o sezione “Informazioni e stato dati” con data dell’ultimo aggiornamento.

### 3.2 Funzionalità utili ma non bloccanti

- tema scuro manuale;
- filtro per categoria;
- ricerca per luogo;
- condivisione della singola giornata;
- esportazione/stampa della giornata;
- link alternativo Naver Map;
- indicazione sintetica del totale giornaliero di camminate e trasferimenti;
- note personali conservate esclusivamente in `localStorage`.

### 3.3 Fuori ambito MVP

- autenticazione;
- sincronizzazione multi-dispositivo;
- modifica online condivisa;
- geolocalizzazione continua;
- tracciamento degli utenti;
- analytics di terze parti;
- prenotazioni o pagamenti;
- notifiche push;
- dati in tempo reale su trasporti, meteo o apertura delle attrazioni.

---

## 4. User story principali

### US-01 — Consultare una giornata

Come viaggiatore, voglio aprire una giornata e vedere tutte le tappe in ordine cronologico, per capire immediatamente cosa devo fare.

**Criteri di accettazione**

- data, numero del giorno e città sono visibili in alto;
- le tappe sono ordinate per orario;
- le informazioni principali non richiedono l’apertura di modali;
- la pagina è utilizzabile su uno schermo largo 320 px.

### US-02 — Aprire la giornata corrente

Come viaggiatore, voglio raggiungere la giornata corrispondente alla data corrente con un solo tocco.

**Criteri di accettazione**

- il pulsante “Oggi” apre la data corrente se compresa tra il 26/07/2026 e il 13/08/2026;
- fuori da tale intervallo il pulsante apre l’indice e mostra un messaggio non invasivo;
- il comportamento dipende dalla data locale del dispositivo.

### US-03 — Consultare il programma offline

Come viaggiatore, voglio leggere l’itinerario senza connessione.

**Criteri di accettazione**

- dopo almeno una visita online, shell applicativa e dati dell’itinerario sono disponibili offline;
- se un contenuto esterno non è disponibile, il sito resta utilizzabile;
- l’interfaccia segnala quando è offline;
- l’aggiornamento della cache non elimina i dati locali sulle tappe completate.

### US-04 — Aprire una tappa sulla mappa

Come viaggiatore, voglio aprire una destinazione nell’app di mappe per avviare la navigazione.

**Criteri di accettazione**

- ogni luogo con dati sufficienti mostra “Apri nella mappa”;
- i link usano coordinate quando validate, altrimenti una query testuale con nome e città;
- i link esterni si aprono in una nuova scheda;
- il sito non dichiara che una posizione è verificata se non lo è.

### US-05 — Segnare le tappe completate

Come viaggiatore, voglio marcare una tappa come completata per capire rapidamente cosa resta da fare.

**Criteri di accettazione**

- lo stato viene salvato in `localStorage`;
- il completamento è reversibile;
- lo stato non viene incluso nell’URL e non viene inviato a servizi esterni;
- è presente una funzione di reset con conferma.

### US-06 — Installare il sito

Come viaggiatore, voglio aggiungere il sito alla schermata iniziale per aprirlo come un’app.

**Criteri di accettazione**

- manifest valido;
- icone previste almeno nelle dimensioni 192×192 e 512×512;
- `display: standalone`;
- nome breve leggibile;
- colori di tema e sfondo coerenti;
- istruzioni manuali per iOS, dove il prompt di installazione può non essere disponibile.

---

## 5. Esperienza utente

### 5.1 Layout mobile

- larghezza contenuto massima: 720 px;
- header compatto e sticky;
- controllo giornata sempre raggiungibile;
- card o blocchi timeline con ampio target touch;
- font base non inferiore a 16 px;
- target interattivi di almeno 44×44 px;
- contrasto conforme almeno a WCAG AA;
- nessuna informazione comunicata esclusivamente tramite colore.

### 5.2 Selettore dei viaggi (home reale, `#/`)

L'app copre più viaggi. La vera home è un selettore che deve mostrare:

1. titolo “I miei viaggi”;
2. stato della connessione;
3. una card per ogni viaggio disponibile, con: titolo, periodo (date di
   inizio/fine), stato calcolato a runtime (“in programma” / “in corso” /
   “concluso”, confrontando la data odierna con `startDate`/`endDate` —
   mai memorizzato nei dati), e una breve sintesi;
4. il tocco su una card apre la home di quel viaggio (`#/trip/:tripId`).

### 5.2bis Home del singolo viaggio (`#/trip/:tripId`)

Selezionato un viaggio, la sua home deve mostrare:

1. titolo del viaggio (es. “Corea 2026”);
2. periodo del viaggio (es. “26 luglio – 13 agosto 2026”);
3. pulsante “Vai a oggi” (attivo solo se la data odierna rientra nel
   periodo del viaggio);
4. elenco cronologico delle giornate;
5. per ogni giornata: data, città, sintesi e stato “dettagli disponibili / da completare”;
6. un link per tornare al selettore dei viaggi.

### 5.3 Pagina o vista giornata

Header della giornata:

- numero del giorno;
- data completa;
- località principale;
- eventuale trasferimento;
- meteo non incluso nell’MVP;
- navigazione precedente/successivo, e un link per tornare al selettore dei
  viaggi.

Corpo:

- timeline verticale;
- orario evidenziato;
- spostamento visualizzato tra una tappa e la successiva;
- durata e costo in metadati secondari;
- note chiaramente separate dai dati confermati;
- call to action “Apri nella mappa”.

### 5.4 Gestione dei dati incompleti

Non inventare informazioni mancanti. Usare stati espliciti:

- `confirmed`: trascritto e verificato;
- `transcribed`: trascritto ma non ancora verificato;
- `uncertain`: testo o valore di dubbia lettura;
- `placeholder`: dettaglio non ancora disponibile.

Nell’interfaccia, i dati `uncertain` devono mostrare un’icona e la dicitura “Da verificare”.

---

## 6. Modello dati

Salvare i contenuti di ciascun viaggio in `data/trips/<id>.json` (un file per
viaggio), elencati in `data/trips/index.json`.

Esempio:

```json
{
  "trip": {
    "id": "korea-2026",
    "title": "Corea 2026",
    "startDate": "2026-07-26",
    "endDate": "2026-08-13",
    "timezone": "Asia/Seoul",
    "lastUpdated": "2026-07-17",
    "contentStatus": "partial"
  },
  "days": [
    {
      "id": "2026-07-26",
      "dayNumber": 1,
      "date": "2026-07-26",
      "city": "Seoul",
      "summary": "Arrivo a Seoul e Myeongdong",
      "detailStatus": "transcribed",
      "items": [
        {
          "id": "2026-07-26-arrival-icn",
          "time": "16:35",
          "type": "transport",
          "title": "Arrivo all’aeroporto di Seoul-Incheon",
          "description": "Arrivo al Terminal 2.",
          "durationMinutes": null,
          "cost": null,
          "status": "transcribed",
          "location": {
            "name": "Incheon International Airport Terminal 2",
            "city": "Incheon",
            "country": "South Korea",
            "latitude": null,
            "longitude": null,
            "googleMapsQuery": "Incheon International Airport Terminal 2",
            "naverMapsUrl": null,
            "verificationStatus": "unverified"
          },
          "transferFromPrevious": null,
          "notes": []
        },
        {
          "id": "2026-07-26-myeongdong-night-market",
          "time": "20:15",
          "type": "market",
          "title": "Myeongdong Night Market",
          "description": null,
          "durationMinutes": null,
          "cost": null,
          "status": "transcribed",
          "location": {
            "name": "Myeongdong Night Market",
            "city": "Seoul",
            "country": "South Korea",
            "latitude": null,
            "longitude": null,
            "googleMapsQuery": "Myeongdong Night Market Seoul",
            "naverMapsUrl": null,
            "verificationStatus": "unverified"
          },
          "transferFromPrevious": {
            "mode": "walk",
            "durationMinutes": 20,
            "notes": null
          },
          "notes": []
        }
      ]
    }
  ]
}
```

### 6.1 Regole sui dati

- date in formato ISO `YYYY-MM-DD`;
- orari in formato locale `HH:mm`;
- durate numeriche in minuti;
- importi rappresentati con valore e valuta se certi, ad esempio:

```json
{
  "amount": 9,
  "currency": "EUR",
  "display": "€9"
}
```

- usare `null` per dati assenti, non stringhe vuote;
- ogni elemento deve avere un ID stabile e univoco;
- non trasformare automaticamente stime in dati certi;
- mantenere separati tempo di visita e tempo di trasferimento;
- conservare nel campo `notes` le annotazioni utili non strutturabili;
- se il testo originale è dubbio, riportarlo nel campo `sourceText` e impostare `status: "uncertain"`.

### 6.2 Schema v2 — `transferFromPrevious` strutturato (retrocompatibile)

A partire da questa versione, `transferFromPrevious` può includere campi
opzionali aggiuntivi oltre a `mode`/`durationMinutes`/`notes`. Le voci più
vecchie che usano solo lo schema base restano valide senza modifiche.

```json
"transferFromPrevious": {
  "mode": "bus",
  "line": "182 / 600",
  "from": { "name": "Jungang Rotary", "nameLocal": "중앙로터리" },
  "to":   { "name": "Jeju ICC",       "nameLocal": "제주국제컨벤션센터" },
  "durationMinutes": 25,
  "frequency": "circa ogni 30 min",
  "fare": { "amount": null, "currency": "KRW", "display": "₩1.200–2.000", "estimated": true },
  "tmoney": true,
  "booking": { "label": "bustago.or.kr", "url": "https://www.bustago.or.kr" },
  "naverQuery": "중앙로터리",
  "estimated": true,
  "notes": "Si sale davanti al Paris Baguette a Jungang Rotary"
}
```

Regole per i nuovi campi (tutti opzionali):

- `line`: numero/nome linea (bus, metro, treno), stringa libera.
- `from` / `to`: `{ "name": ..., "nameLocal": ... }` — `nameLocal` solo se
  noto (nome nella grafia locale, es. hangul).
- `frequency`: stringa libera sulla frequenza del mezzo (es. "ogni ~30 min").
- `fare`: oggetto "money" generalizzato (vedi sotto) per il costo del
  singolo spostamento, distinto da `cost` della tappa.
- `tmoney`: `true` se pagabile con T-money, `false` se no, `null`/assente se
  non noto.
- `booking`: `{ "label": ..., "url": ... }` solo per bus intercity
  (bustago.or.kr), Korail (letskorail.com), compagnie aeree; `url` deve
  essere `https:`. I mezzi urbani (bus/metro cittadini) non hanno
  `booking`.
- `naverQuery`: testo per il link di ricerca Naver Map (vedi §11.2); se
  assente si usa `to.nameLocal`, poi `to.name`.
- `estimated`: `true` se l'intero spostamento è una stima di pianificazione
  (non ancora verificata sul posto); va sempre mostrato in UI con un
  indicatore neutro ("≈ stima"), mai promosso silenziosamente a dato certo.

Oggetto "money" generalizzato (usato sia in `cost` che in `fare`):

```json
{ "amount": null, "currency": "KRW", "display": "₩1.200–2.000", "estimated": true }
```

- `currency`: libera (`EUR`, `KRW`, ...);
- `estimated`: opzionale, `true` se l'importo è una stima.

---

## 7. Contenuto iniziale

### 7.1 Itinerario generale disponibile

| Data | Tappa |
|---|---|
| 26/7 | Seoul |
| 27/7 | Seoul |
| 28/7 | Seoul |
| 29/7 | Seoul |
| 30/7 | Seoul → treno → Suwon → treno → Seoul |
| 31/7 | Seoul → bus → Andong |
| 1/8 | Andong → bus → Gyeongju |
| 2/8 | Gyeongju → Daegu |
| 3/8 | Daegu → bus → Busan |
| 4/8 | Busan |
| 5/8 | Busan |
| 6/8 | Busan |
| 7/8 | Busan → bus → Jeonju |
| 8/8 | Jeonju → bus → Suncheon |
| 9/8 | Suncheon → bus → Boseong → bus → Gwangju → aereo → Jeju |
| 10/8 | Jeju |
| 11/8 | Jeju |
| 12/8 | Jeju → aereo → Seoul |
| 13/8 | Seoul |

### 7.2 Stato dei dettagli

- dettagli giornalieri trascritti disponibili dal **26/7 al 8/8**;
- per il periodo **9/8–13/8** è disponibile, al momento, solo l’itinerario generale;
- il sito deve mostrare questi ultimi giorni con `detailStatus: "placeholder"`, senza inventare attività;
- prima della pubblicazione definitiva, importare la trascrizione completa già preparata e farla validare rispetto alle fotografie originali;
- correggere soltanto errori certi; mantenere marcati i punti dubbi.

### 7.3 Punti già identificati come da verificare

- nome o costo dell’hotel del 26/7;
- prima parte della nota relativa all’arrivo ad Andong il 31/7;
- ultima tappa del percorso “Modern History Street” del 2/8;
- alcune note secondarie della Songdo Cable Car del 4/8;
- possibile sovrapposizione di orario tra Jeondong Catholic Cathedral e Pungnammun Gate il 7/8;
- nomi romanizzati delle attrazioni e coordinate geografiche.

---

## 8. Struttura del repository

> Nota: questo repository è in fase di rename da `south-courea-2026` a
> `my-travel-log`, perché copre più di un viaggio (non solo la Corea).

```text
my-travel-log/
├── index.html
├── 404.html
├── manifest.webmanifest
├── sw.js
├── README.md
├── LICENSE
├── .gitignore
├── assets/
│   ├── css/
│   │   └── app.css
│   ├── js/
│   │   ├── app.js
│   │   ├── data.js
│   │   ├── router.js
│   │   ├── storage.js
│   │   └── ui.js
│   ├── icons/
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   └── maskable-512.png
│   └── images/
├── data/
│   └── trips/
│       ├── index.json
│       ├── korea-2026.json
│       └── china-2025.json
├── tests/
│   ├── itinerary.test.js
│   └── links.test.js
└── .github/
    └── workflows/
        └── validate.yml
```

Per evitare problemi con il percorso di progetto di GitHub Pages, usare riferimenti relativi, ad esempio `./assets/css/app.css`, e non percorsi assoluti come `/assets/css/app.css`.

---

## 9. Routing

Per massima compatibilità con GitHub Pages, evitare routing client-side basato su path nella prima versione.

Usare una singola pagina con hash routing a tre livelli (selettore viaggi →
home del viaggio → giornata):

```text
./#/
./#/trip/korea-2026
./#/trip/korea-2026/day/2026-07-26
./#/trip/china-2025
./#/trip/china-2025/day/2025-08-19
```

Vantaggi:

- nessuna configurazione server;
- refresh affidabile;
- migrazione semplice;
- nessun workaround obbligatorio sulla pagina 404.

La `404.html` deve comunque offrire un link alla home e può reindirizzare alla base del sito senza assumere un dominio specifico.

---

## 10. PWA e funzionamento offline

### 10.1 Manifest

Configurazione minima suggerita:

```json
{
  "name": "My Trips — Itinerari di viaggio",
  "short_name": "My Trips",
  "description": "Itinerari dei miei viaggi",
  "lang": "it-IT",
  "start_url": "./#/",
  "scope": "./",
  "display": "standalone",
  "background_color": "#f7f3ea",
  "theme_color": "#b42318",
  "icons": [
    {
      "src": "./assets/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "./assets/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "./assets/icons/maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### 10.2 Strategia di cache

- shell applicativa: **cache first**;
- `data/trips/index.json` e `data/trips/<id>.json`: **stale while revalidate** o network first con fallback alla cache;
- mappe e link esterni: non precaricare;
- immagini non essenziali: lazy loading;
- usare un nome cache versionato, ad esempio `my-travel-log-v2`;
- all’attivazione del nuovo Service Worker eliminare soltanto cache applicative obsolete;
- non interferire con `localStorage`.

### 10.3 Aggiornamenti

Quando è disponibile una nuova versione, il Service Worker la attiva in modo
automatico (nessun banner con pulsante da premere): la maggior parte dei
visitatori non nota né clicca un banner tecnico, quindi affidarsi a un'azione
manuale lascia molte persone bloccate su contenuti obsoleti a tempo
indeterminato. Requisiti:

- il nuovo Service Worker chiama `skipWaiting()` in modo incondizionato
  nell'evento `install`, subito dopo aver popolato la cache dell'app shell;
- lato pagina, l'evento `controllerchange` provoca un ricaricamento
  automatico (non richiede alcun clic dell'utente); un breve avviso testuale
  informa che è in corso un aggiornamento;
- il ricaricamento automatico non avviene alla primissima installazione (solo
  quando esisteva già un controller precedente), per evitare un reload senza
  motivo al primo accesso;
- per non dipendere solo dal controllo automatico del browser (limitato a
  circa una volta ogni 24 ore per le verifiche legate alla navigazione), la
  pagina richiama esplicitamente `registration.update()` alla registrazione,
  ogni volta che l'app torna in primo piano (`visibilitychange`) e
  periodicamente mentre resta aperta;
- mantenere i dati locali compatibili tra versioni o prevedere una
  migrazione esplicita.

### 10.4 Offline fallback

Se l’utente apre per la prima volta il sito senza connessione, mostrare una pagina chiara che spiega che è necessario un primo accesso online. Non mostrare una pagina bianca o un errore tecnico.

---

## 11. Link alle mappe

### 11.1 Google Maps

Generare i link in JavaScript usando `URL` e `URLSearchParams`, evitando concatenazioni non codificate.

Esempio concettuale:

```js
function buildGoogleMapsSearchUrl(location) {
  const url = new URL("https://www.google.com/maps/search/");
  const query = location.latitude != null && location.longitude != null
    ? `${location.latitude},${location.longitude}`
    : [location.name, location.city, location.country].filter(Boolean).join(", ");

  url.searchParams.set("api", "1");
  url.searchParams.set("query", query);
  return url.toString();
}
```

Non serve una chiave API per semplici link esterni. Non integrare mappe embedded nell’MVP.

### 11.2 Naver Map

Per i **luoghi** (`location.naverMapsUrl`): aggiungere un link Naver solo
quando l’URL è stato verificato manualmente. In assenza di URL valido,
mostrare soltanto Google Maps e un pulsante per copiare il nome coreano del
luogo, se disponibile.

Per i **connettori di trasferimento** (`transferFromPrevious`, schema v2,
§6.2): il link Naver è generato lato client come URL di ricerca da
`naverQuery` (o, in assenza, da `to.nameLocal`/`to.name`), non richiede una
verifica manuale preventiva perché è una semplice ricerca testuale:
`https://map.naver.com/v5/search/{encodeURIComponent(query)}`.

### 11.3 Sicurezza link esterni

Usare:

```html
<a target="_blank" rel="noopener noreferrer">Apri nella mappa</a>
```

---

## 12. Persistenza locale

Le tappe completate sono namespaced per viaggio (un viaggio non deve mai
mostrare come completate le tappe di un altro); tema e schema version restano
condivisi tra tutti i viaggi. Chiavi suggerite:

```text
trip.<tripId>.completedItems   # es. trip.korea-2026.completedItems
korea2026.theme
korea2026.notes
korea2026.schemaVersion
```

Esempio stato completamenti (per il viaggio `korea-2026`):

```json
{
  "2026-07-26-arrival-icn": true,
  "2026-07-26-myeongdong-night-market": true
}
```

Requisiti:

- nessun dato personale;
- gestione sicura di JSON corrotto;
- default vuoto in caso di errore;
- versione dello schema;
- reset separato per completamenti e note, sempre scoped al viaggio aperto.

---

## 13. Accessibilità

- usare `header`, `nav`, `main`, `section`, `article`, `footer`;
- un solo `h1` per vista;
- gerarchia coerente degli heading;
- focus visibile;
- `aria-current="page"` sulla giornata attiva;
- `aria-live="polite"` per stato offline e aggiornamenti;
- checkbox reali per le tappe completate;
- testo alternativo per immagini informative;
- supporto a `prefers-reduced-motion`;
- evitare animazioni non necessarie;
- testare zoom browser al 200%;
- non bloccare orientamento o ridimensionamento.

---

## 14. Sicurezza e privacy

### 14.1 Dati vietati nel repository

Non pubblicare:

- numeri di passaporto o documenti;
- carte d’imbarco;
- PNR e codici di prenotazione;
- numeri di telefono personali;
- scansioni di documenti;
- credenziali e token;
- indirizzi privati non necessari;
- dettagli finanziari;
- copie integrali di voucher con QR code.

GitHub Pages pubblica il sito su Internet. Un repository privato, se il piano consente Pages, non rende automaticamente privato il sito pubblicato. Trattare quindi tutto il contenuto del sito come pubblico.

### 14.2 Sicurezza applicativa

- nessun secret nel JavaScript;
- nessun uso di `innerHTML` con dati non controllati;
- rendering tramite `textContent` o template statici;
- dipendenze ridotte al minimo;
- se si aggiungono dipendenze, bloccare le versioni e attivare Dependabot;
- definire una Content Security Policy compatibile con il sito statico;
- nessun form che raccolga dati;
- nessun analytics nell’MVP.

CSP iniziale suggerita, da adattare e testare:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'">
```

---

## 15. Git e modalità di lavoro

### 15.1 Branch

- `main`: produzione;
- branch brevi `feature/...`, `fix/...`, `content/...`;
- modifiche tramite pull request;
- vietato il push diretto su `main` dopo il bootstrap iniziale.

### 15.2 Protezioni consigliate

- almeno una approvazione;
- status check obbligatori;
- branch aggiornato prima del merge;
- risoluzione delle conversazioni obbligatoria;
- cancellazione automatica del branch dopo il merge;
- squash merge per mantenere una cronologia leggibile.

### 15.3 Commit

Formato suggerito:

```text
feat: add daily timeline navigation
fix: correct service worker base path
content: update Gyeongju itinerary
chore: bump cache version
```

---

## 16. Pubblicazione iniziale su GitHub Pages

### 16.1 Repository

Nome suggerito:

```text
my-travel-log
```

Con un project site, l’indirizzo predefinito avrà normalmente questa struttura:

```text
https://<account>.github.io/my-travel-log/
```

Non codificare l’account o questo percorso nel codice.

### 16.2 Configurazione consigliata per l’MVP

Poiché il sito non richiede build:

1. creare il repository;
2. aggiungere i file alla root;
3. fare push su `main`;
4. aprire **Settings → Pages**;
5. in **Build and deployment**, scegliere **Deploy from a branch**;
6. selezionare branch `main` e cartella `/ (root)`;
7. salvare;
8. abilitare **Enforce HTTPS** quando disponibile;
9. aprire l’URL pubblicato e verificare asset, manifest e Service Worker.

Questa modalità è preferibile per l’MVP perché non esiste un processo di build. GitHub supporta anche workflow Actions personalizzati; usarli solo se il progetto introdurrà build, bundling o controlli di rilascio più articolati.

### 16.3 Validazione con GitHub Actions

Anche se il deploy avviene da branch, aggiungere un workflow di validazione su pull request.

Esempio `.github/workflows/validate.yml`:

```yaml
name: Validate static site

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Validate
        run: npm test
```

Se il repository non usa Node, sostituire il workflow con strumenti adeguati oppure ometterlo fino all’introduzione dei test automatici. Non aggiungere un `npm ci` senza `package.json` e lock file.

---

## 17. Test

### 17.1 Test funzionali minimi

- apertura home;
- apertura di ogni giornata;
- navigazione precedente/successiva;
- pulsante “Oggi” dentro e fuori dal periodo;
- completamento e ripristino tappa;
- persistenza dopo refresh;
- reset dati locali;
- apertura mappe;
- visualizzazione dei placeholder;
- comportamento offline;
- aggiornamento Service Worker;
- installazione PWA dove supportata.

### 17.2 Test dati

Validare automaticamente:

- unicità degli ID;
- date nel periodo del viaggio;
- ordine cronologico delle giornate;
- formato degli orari;
- valori ammessi per `type` e `status`;
- durata non negativa;
- URL validi;
- coordinate entro intervalli validi;
- assenza di campi sensibili noti;
- presenza di titolo e data per ogni giornata.

### 17.3 Browser e dispositivi

Test minimo:

- Safari su iPhone;
- Chrome su Android;
- Chrome desktop;
- Edge desktop;
- modalità offline tramite DevTools;
- rete lenta simulata;
- schermo 320 px;
- landscape;
- zoom 200%.

### 17.4 Lighthouse

Eseguire Lighthouse come controllo indicativo per:

- Performance;
- Accessibility;
- Best Practices;
- SEO;
- PWA/installabilità, se presente nella versione degli strumenti utilizzata.

Non ottimizzare per il punteggio sacrificando leggibilità o affidabilità.

---

## 18. Definition of Done MVP

L’MVP è completato quando:

- il sito è raggiungibile via HTTPS su GitHub Pages;
- tutte le giornate 26/7–13/8 compaiono nell’indice;
- i dettagli disponibili 26/7–8/8 sono importati;
- i giorni 9/8–13/8 sono mostrati come incompleti e non contengono dati inventati;
- il sito è utilizzabile da smartphone;
- la shell e l’itinerario sono consultabili offline dopo il primo caricamento;
- manifest e icone sono corretti;
- le tappe completate persistono localmente;
- i link alle mappe funzionano;
- i punti dubbi sono chiaramente marcati;
- non sono presenti dati sensibili;
- i test critici sono superati;
- README e istruzioni di manutenzione sono aggiornati.

---

## 19. Migrazione futura a Cloudflare Pages

La migrazione deve richiedere solo il cambio del provider di hosting.

Per garantirlo:

- usare esclusivamente file statici;
- mantenere percorsi relativi;
- non dipendere da Jekyll;
- non usare plugin specifici di GitHub Pages;
- non incorporare il dominio nel codice;
- non usare API GitHub a runtime;
- mantenere configurazione e contenuti nel repository;
- separare dati e interfaccia.

Quando si migrerà:

1. collegare lo stesso repository a Cloudflare Pages;
2. impostare la directory di output sulla root, se il sito resta senza build;
3. verificare base path, manifest e Service Worker;
4. testare cache e link assoluti;
5. associare eventualmente un dominio personalizzato;
6. mantenere temporaneamente GitHub Pages come fallback finché la nuova pubblicazione non è verificata.

---

## 20. Backlog successivo

Priorità suggerita:

1. completare e validare i dettagli 9/8–13/8;
2. verificare coordinate e nomi coreani;
3. aggiungere Naver Map;
4. introdurre ricerca e filtri;
5. aggiungere stime aggregate di camminate e trasferimenti;
6. aggiungere modalità stampa/PDF;
7. aggiungere import/export locale delle note;
8. valutare Cloudflare Pages e dominio personalizzato;
9. valutare aggiornamenti dati automatizzati soltanto se realmente necessari.

---

## 21. Deliverable richiesti al team

- repository GitHub configurato;
- codice sorgente completo;
- `data/trips/index.json` e ogni `data/trips/<id>.json` popolati;
- PWA manifest e icone;
- Service Worker;
- test automatici sui dati;
- workflow di validazione;
- sito pubblicato su GitHub Pages;
- README con:
  - avvio locale;
  - struttura dati;
  - modifica dell’itinerario;
  - pubblicazione;
  - gestione della cache;
  - troubleshooting;
- breve checklist di verifica pre-viaggio;
- nessun dato sensibile nella cronologia Git.

---

## 22. Checklist pre-viaggio

- [ ] Tutte le giornate sono presenti.
- [ ] I dettagli mancanti 9/8–13/8 sono stati completati oppure restano esplicitamente marcati.
- [ ] Orari e trasferimenti sono stati verificati.
- [ ] Hotel e stazioni sono stati verificati.
- [ ] Link Google Maps testati da smartphone.
- [ ] Eventuali link Naver Map testati.
- [ ] Sito aperto almeno una volta sul telefono prima della partenza.
- [ ] Modalità aereo testata.
- [ ] Sito aggiunto alla schermata iniziale.
- [ ] PDF o copia locale di emergenza salvata sul telefono.
- [ ] Nessun documento o codice di prenotazione è pubblico.
- [ ] Cache aggiornata dopo l’ultima modifica.
- [ ] Ultimo commit di produzione identificabile tramite tag.

Tag suggerito:

```text
trip-ready-2026-07
```

---

## 23. Riferimenti ufficiali

- [Documentazione GitHub Pages](https://docs.github.com/pages)
- [Creare un sito GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Configurare la sorgente di pubblicazione](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Workflow personalizzati per GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Proteggere GitHub Pages con HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Domini personalizzati su GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)

---

## 24. Decisioni da non lasciare implicite

Per l’MVP sono già assunte le seguenti decisioni:

- sito pubblico;
- hosting iniziale GitHub Pages;
- repository dedicato;
- deploy dalla root di `main`;
- nessun backend;
- nessuna autenticazione;
- nessun framework;
- hash routing;
- dati in JSON statico;
- PWA offline;
- stato utente solo locale;
- nessun analytics;
- Google Maps come link principale;
- Cloudflare Pages come possibile evoluzione, non come requisito iniziale.
