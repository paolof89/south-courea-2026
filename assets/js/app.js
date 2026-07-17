// Corea 2026 — main application module (vanilla ES module).
// - Loads itinerary from ./data/itinerary.json
// - Hash router: #/ (home) and #/day/YYYY-MM-DD (day detail)
// - Renders content with textContent only, never innerHTML with data
// - Registers the service worker

'use strict';

const DATA_URL = './data/itinerary.json';

const state = {
  itinerary: null,
  error: null,
};

const mainEl = document.getElementById('main');
const connectionStatusEl = document.getElementById('connection-status');
const lastUpdatedEl = document.getElementById('last-updated');

// ---------- Utilities ----------

/** Format an ISO date (YYYY-MM-DD) into a localized Italian long date. */
function formatDateLong(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Format ISO date as short "26/07". */
function formatDateShort(isoDate) {
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
}

/** Build a Google Maps search URL from a location object. */
function buildGoogleMapsSearchUrl(location) {
  if (!location) return null;
  const hasCoords =
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number';
  const query = hasCoords
    ? `${location.latitude},${location.longitude}`
    : [location.name, location.city, location.country]
        .filter(Boolean)
        .join(', ');
  if (!query) return null;
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', query);
  return url.toString();
}

/** Clear all children of a node. */
function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Create an element with optional class and text content. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// ---------- Data loading ----------

async function loadItinerary() {
  const response = await fetch(DATA_URL, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

// ---------- Rendering: home ----------

function renderHome() {
  clear(mainEl);
  const { trip, days } = state.itinerary;

  const section = el('section', 'home');
  section.setAttribute('aria-labelledby', 'home-title');

  const h1 = el('h1', 'home__title', trip.title);
  h1.id = 'home-title';
  section.appendChild(h1);

  const intro = el(
    'p',
    'home__intro',
    `Itinerario dal ${formatDateShort(trip.startDate)} al ${formatDateShort(trip.endDate)} ${trip.endDate.slice(0, 4)}.`,
  );
  section.appendChild(intro);

  const list = el('ul', 'day-list');
  list.setAttribute('aria-label', 'Elenco delle giornate');

  for (const day of days) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'day-card';
    link.href = `#/day/${day.id}`;

    const header = el('div', 'day-card__header');
    header.appendChild(el('span', 'day-card__date', formatDateLong(day.date)));
    header.appendChild(el('span', 'day-card__number', `Giorno ${day.dayNumber}`));
    link.appendChild(header);

    link.appendChild(el('p', 'day-card__city', day.city));

    if (day.summary) {
      link.appendChild(el('p', 'day-card__summary', day.summary));
    }

    const status = el(
      'span',
      day.detailStatus === 'placeholder'
        ? 'day-card__status day-card__status--placeholder'
        : 'day-card__status',
      day.detailStatus === 'placeholder' ? 'Da completare' : 'Dettagli disponibili',
    );
    link.appendChild(status);

    li.appendChild(link);
    list.appendChild(li);
  }

  section.appendChild(list);
  mainEl.appendChild(section);
  mainEl.focus();
}

// ---------- Rendering: day detail ----------

function renderDay(dayId) {
  clear(mainEl);
  const { days } = state.itinerary;
  const index = days.findIndex((d) => d.id === dayId);

  if (index === -1) {
    const err = el('div', 'error', 'Giornata non trovata.');
    const backLink = el('p');
    const a = el('a', null, 'Torna all’indice');
    a.href = '#/';
    backLink.appendChild(a);
    err.appendChild(backLink);
    mainEl.appendChild(err);
    return;
  }

  const day = days[index];
  const prev = index > 0 ? days[index - 1] : null;
  const next = index < days.length - 1 ? days[index + 1] : null;

  const article = el('article', 'day');
  article.setAttribute('aria-labelledby', 'day-title');

  // Navigation
  const nav = el('nav', 'day-nav');
  nav.setAttribute('aria-label', 'Navigazione tra le giornate');

  const prevBtn = el('a', 'day-nav__btn', '← Precedente');
  if (prev) {
    prevBtn.href = `#/day/${prev.id}`;
  } else {
    prevBtn.setAttribute('aria-disabled', 'true');
    prevBtn.href = '#/';
  }
  nav.appendChild(prevBtn);

  const indexBtn = el('a', 'day-nav__btn', 'Indice');
  indexBtn.href = '#/';
  nav.appendChild(indexBtn);

  const nextBtn = el('a', 'day-nav__btn', 'Successivo →');
  if (next) {
    nextBtn.href = `#/day/${next.id}`;
  } else {
    nextBtn.setAttribute('aria-disabled', 'true');
    nextBtn.href = '#/';
  }
  nav.appendChild(nextBtn);

  article.appendChild(nav);

  // Header
  const header = el('header', 'day-header');
  header.appendChild(el('p', 'day-header__number', `Giorno ${day.dayNumber}`));
  const h1 = el('h1', 'day-header__date', formatDateLong(day.date));
  h1.id = 'day-title';
  header.appendChild(h1);
  header.appendChild(el('p', 'day-header__city', day.city));
  if (day.transferSummary) {
    header.appendChild(el('p', 'day-header__transfer', day.transferSummary));
  }
  article.appendChild(header);

  // Body
  if (day.detailStatus === 'placeholder' || !day.items || day.items.length === 0) {
    const box = el('div', 'placeholder-box');
    box.appendChild(
      el(
        'p',
        null,
        'I dettagli di questa giornata non sono ancora stati inseriti. È disponibile solo l’itinerario generale.',
      ),
    );
    article.appendChild(box);
  } else {
    article.appendChild(renderTimeline(day.items));
  }

  mainEl.appendChild(article);
  mainEl.focus();
}

function renderTimeline(items) {
  const list = el('ol', 'timeline');
  list.setAttribute('aria-label', 'Tappe della giornata');

  for (const item of items) {
    const li = el('li', `timeline-item timeline-item--${item.type || 'visit'}`);

    // Transfer from previous (rendered above the item's own info)
    if (item.transferFromPrevious) {
      const t = item.transferFromPrevious;
      const parts = [];
      if (t.mode) parts.push(labelForTransferMode(t.mode));
      if (t.durationMinutes != null) parts.push(`${t.durationMinutes} min`);
      const transferText = parts.length
        ? `Spostamento: ${parts.join(' · ')}`
        : 'Spostamento dalla tappa precedente';
      li.appendChild(el('p', 'timeline-item__transfer', transferText));
    }

    const timeLine = el('p', 'timeline-item__time', item.time || '—');
    if (item.type) {
      timeLine.appendChild(
        el('span', 'timeline-item__type', labelForType(item.type)),
      );
    }
    li.appendChild(timeLine);

    li.appendChild(el('h2', 'timeline-item__title', item.title));

    if (item.description) {
      li.appendChild(el('p', 'timeline-item__description', item.description));
    }

    if (item.durationMinutes != null) {
      li.appendChild(
        el('p', 'timeline-item__meta', `Durata prevista: ${item.durationMinutes} min`),
      );
    }

    if (item.cost && item.cost.display) {
      li.appendChild(el('p', 'timeline-item__meta', `Costo: ${item.cost.display}`));
    }

    if (item.status === 'uncertain') {
      li.appendChild(el('span', 'timeline-item__uncertain', 'Da verificare'));
    }

    const mapUrl = buildGoogleMapsSearchUrl(item.location);
    if (mapUrl) {
      const a = el('a', 'timeline-item__map-link', 'Apri nella mappa');
      a.href = mapUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      li.appendChild(a);
    }

    list.appendChild(li);
  }

  return list;
}

function labelForType(type) {
  const map = {
    visit: 'Visita',
    transport: 'Trasferimento',
    market: 'Mercato',
    meal: 'Pasto',
    hotel: 'Hotel',
    optional: 'Facoltativa',
  };
  return map[type] || type;
}

function labelForTransferMode(mode) {
  const map = {
    walk: 'a piedi',
    subway: 'metro',
    train: 'treno',
    bus: 'bus',
    taxi: 'taxi',
    car: 'auto',
    plane: 'aereo',
    ferry: 'traghetto',
  };
  return map[mode] || mode;
}

// ---------- Router ----------

function parseHash() {
  const hash = window.location.hash || '#/';
  // Expected forms: "#/", "#/day/2026-07-26"
  if (hash === '#/' || hash === '#' || hash === '') {
    return { route: 'home' };
  }
  const dayMatch = hash.match(/^#\/day\/(\d{4}-\d{2}-\d{2})$/);
  if (dayMatch) {
    return { route: 'day', dayId: dayMatch[1] };
  }
  return { route: 'unknown' };
}

function render() {
  if (state.error) {
    clear(mainEl);
    const err = el(
      'div',
      'error',
      `Impossibile caricare l’itinerario: ${state.error}`,
    );
    mainEl.appendChild(err);
    return;
  }
  if (!state.itinerary) return;

  const parsed = parseHash();
  if (parsed.route === 'day') {
    renderDay(parsed.dayId);
  } else if (parsed.route === 'unknown') {
    window.location.hash = '#/';
  } else {
    renderHome();
  }
  window.scrollTo(0, 0);
}

// ---------- Connection status ----------

function updateConnectionStatus() {
  if (!connectionStatusEl) return;
  if (navigator.onLine) {
    connectionStatusEl.hidden = true;
    connectionStatusEl.textContent = '';
  } else {
    connectionStatusEl.hidden = false;
    connectionStatusEl.textContent = 'Sei offline — dati in cache locale.';
  }
}

// ---------- Service worker ----------

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => {
        console.warn('Registrazione Service Worker fallita:', err);
      });
  });
}

// ---------- Bootstrap ----------

async function init() {
  window.addEventListener('hashchange', render);
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  updateConnectionStatus();

  try {
    state.itinerary = await loadItinerary();
    if (lastUpdatedEl && state.itinerary.trip && state.itinerary.trip.lastUpdated) {
      lastUpdatedEl.textContent = `Ultimo aggiornamento dati: ${state.itinerary.trip.lastUpdated}`;
    }
  } catch (err) {
    state.error = err.message || String(err);
  }
  render();
  registerServiceWorker();
}

init();
