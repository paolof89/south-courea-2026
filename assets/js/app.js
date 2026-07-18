// My Trips — main application module (vanilla ES module).
// - Loads the trips index from ./data/trips/index.json, then lazily loads
//   each trip's own itinerary file (trips[].dataUrl) on first visit.
// - Hash router: #/ (trip picker), #/trip/:tripId (trip home),
//   #/trip/:tripId/day/YYYY-MM-DD (day detail)
// - Renders content with textContent only, never innerHTML with data
// - Registers the service worker

'use strict';

import {
  getCompletedMap,
  setItemCompleted,
  resetCompleted,
  getTheme,
  setTheme,
} from './storage.js';

const TRIPS_INDEX_URL = './data/trips/index.json';

const state = {
  tripsIndex: null,
  trips: new Map(), // tripId -> loaded itinerary { trip, days }
  currentTripId: null,
  error: null,
};

const mainEl = document.getElementById('main');
const connectionStatusEl = document.getElementById('connection-status');
const lastUpdatedEl = document.getElementById('last-updated');
const tripContextEl = document.getElementById('trip-context');
const themeToggleEl = document.getElementById('theme-toggle');
const resetCompletedEl = document.getElementById('reset-completed');
const updateBannerEl = document.getElementById('update-banner');

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

/** Today's date in the device's local timezone, as YYYY-MM-DD. */
function getTodayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Decorative emoji icon per item type (always paired with a text label). */
function iconForType(type) {
  const map = {
    visit: '📍',
    transport: '🚌',
    market: '🛍️',
    meal: '🍜',
    hotel: '🏨',
    optional: '⭐',
  };
  return map[type] || '📍';
}

/** Count of completed vs total items across a list of items, for a given trip. */
function countProgress(tripId, items) {
  const completed = getCompletedMap(tripId);
  const total = items.length;
  const done = items.filter((item) => Boolean(completed[item.id])).length;
  return { done, total };
}

/** All items across all non-placeholder days, for the trip-wide progress bar. */
function getAllItems(days) {
  const all = [];
  for (const day of days) {
    if (Array.isArray(day.items)) all.push(...day.items);
  }
  return all;
}

/** Decorative emoji icon per transfer mode (always paired with a text label). */
function iconForTransferMode(mode) {
  const map = {
    walk: '🚶',
    subway: '🚇',
    train: '🚆',
    bus: '🚌',
    taxi: '🚕',
    car: '🚗',
    plane: '✈️',
    ferry: '⛴️',
  };
  return map[mode] || '🚏';
}

/** Capitalize the first letter of a string (used for connector summary text). */
function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Format a money object for display. Supports both the legacy shape
 * `{ amount, currency, display }` and the v2 shape that also carries
 * `estimated`. Returns null when there is nothing displayable.
 */
function formatMoney(money) {
  if (!money) return null;
  if (money.display) return money.display;
  if (money.amount != null && money.currency) return `${money.amount} ${money.currency}`;
  return null;
}

/** Format a transfer stop (from/to) as "Name (nameLocal)" when a local name is known. */
function formatStop(stop) {
  if (!stop || !stop.name) return null;
  return stop.nameLocal ? `${stop.name} (${stop.nameLocal})` : stop.name;
}

/**
 * Build a Naver Map search URL for a transfer, per SPEC §20.3.
 * Falls back from `naverQuery` to the destination's local name, then its name.
 */
function buildNaverMapsUrl(t) {
  const query = (t && t.naverQuery) || (t && t.to && (t.to.nameLocal || t.to.name));
  if (!query) return null;
  return `https://map.naver.com/v5/search/${encodeURIComponent(query)}`;
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

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

/** Loads (and caches) a single trip's itinerary data by id, using its `dataUrl` from the trips index. */
async function loadTrip(tripId) {
  if (state.trips.has(tripId)) return state.trips.get(tripId);
  const entry = (state.tripsIndex || []).find((t) => t.id === tripId);
  if (!entry) throw new Error(`Viaggio sconosciuto: ${tripId}`);
  const itinerary = await fetchJson(entry.dataUrl);
  state.trips.set(tripId, itinerary);
  return itinerary;
}

// ---------- Rendering: trip picker (real home) ----------

/** Computes upcoming/ongoing/past from today's date; never stored in data. */
function tripStatus(trip, todayId) {
  if (todayId < trip.startDate) return { modifier: 'upcoming', label: 'In programma' };
  if (todayId > trip.endDate) return { modifier: 'past', label: 'Concluso' };
  return { modifier: 'ongoing', label: 'In corso' };
}

function renderTripPicker(tripsIndex) {
  clear(mainEl);
  const todayId = getTodayIsoDate();

  const section = el('section', 'home');
  section.setAttribute('aria-labelledby', 'home-title');

  const h1 = el('h1', 'home__title', 'I miei viaggi');
  h1.id = 'home-title';
  section.appendChild(h1);

  section.appendChild(
    el('p', 'home__intro', 'Scegli un viaggio per consultarne l’itinerario.'),
  );

  const list = el('ul', 'trip-list');
  list.setAttribute('aria-label', 'Elenco dei viaggi');

  for (const trip of tripsIndex) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'trip-card';
    link.href = `#/trip/${trip.id}`;

    const header = el('div', 'trip-card__header');
    header.appendChild(el('span', 'trip-card__title', trip.title));
    const status = tripStatus(trip, todayId);
    header.appendChild(
      el('span', `trip-card__badge trip-card__badge--${status.modifier}`, status.label),
    );
    link.appendChild(header);

    link.appendChild(
      el(
        'p',
        'trip-card__dates',
        `${formatDateShort(trip.startDate)} – ${formatDateShort(trip.endDate)} ${trip.endDate.slice(0, 4)}`,
      ),
    );

    if (trip.summary) {
      link.appendChild(el('p', 'trip-card__summary', trip.summary));
    }

    li.appendChild(link);
    list.appendChild(li);
  }

  section.appendChild(list);
  mainEl.appendChild(section);
  mainEl.focus();
}

// ---------- Rendering: trip home ----------

function renderTripHome(tripId, itinerary) {
  clear(mainEl);
  const { trip, days } = itinerary;
  const todayId = getTodayIsoDate();

  const section = el('section', 'home');
  section.setAttribute('aria-labelledby', 'home-title');

  const backLink = el('a', 'home__back', '← Tutti i viaggi');
  backLink.href = '#/';
  section.appendChild(backLink);

  const h1 = el('h1', 'home__title', trip.title);
  h1.id = 'home-title';
  section.appendChild(h1);

  const intro = el(
    'p',
    'home__intro',
    `Itinerario dal ${formatDateShort(trip.startDate)} al ${formatDateShort(trip.endDate)} ${trip.endDate.slice(0, 4)}.`,
  );
  section.appendChild(intro);

  // Trip-wide progress
  const allItems = getAllItems(days);
  if (allItems.length > 0) {
    const { done, total } = countProgress(tripId, allItems);
    section.appendChild(buildProgressBar(done, total, 'Avanzamento del viaggio'));
  }

  // "Vai a oggi" call to action
  const todayWrap = el('div', 'home__today');
  const todayBtn = el('button', 'home__today-btn', 'Vai a oggi');
  todayBtn.type = 'button';
  const todayStatus = el('p', 'home__today-status');
  todayStatus.setAttribute('role', 'status');
  const hasToday = days.some((d) => d.id === todayId);
  todayBtn.addEventListener('click', () => {
    if (hasToday) {
      window.location.hash = `#/trip/${tripId}/day/${todayId}`;
      return;
    }
    todayStatus.textContent =
      todayId < trip.startDate
        ? 'Il viaggio non è ancora iniziato.'
        : 'Il viaggio è terminato.';
  });
  todayWrap.appendChild(todayBtn);
  todayWrap.appendChild(todayStatus);
  section.appendChild(todayWrap);

  // Search
  const searchWrap = el('div', 'home__search');
  const searchLabel = el('label', 'home__search-label', 'Cerca per città o descrizione');
  searchLabel.htmlFor = 'day-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.id = 'day-search';
  searchInput.className = 'home__search-input';
  searchInput.placeholder = 'Es. Busan, mercato…';
  const searchResults = el('p', 'home__search-results');
  searchResults.setAttribute('aria-live', 'polite');
  searchWrap.appendChild(searchLabel);
  searchWrap.appendChild(searchInput);
  searchWrap.appendChild(searchResults);
  section.appendChild(searchWrap);

  const list = el('ul', 'day-list');
  list.setAttribute('aria-label', 'Elenco delle giornate');

  for (const day of days) {
    const isToday = day.id === todayId;
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = isToday ? 'day-card day-card--today' : 'day-card';
    link.href = `#/trip/${tripId}/day/${day.id}`;
    if (isToday) link.setAttribute('aria-current', 'date');

    // Text used for client-side search matching.
    link.dataset.searchText = [day.city, day.summary, formatDateShort(day.date)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const header = el('div', 'day-card__header');
    header.appendChild(el('span', 'day-card__date', formatDateLong(day.date)));
    header.appendChild(el('span', 'day-card__number', `Giorno ${day.dayNumber}`));
    link.appendChild(header);

    const cityRow = el('p', 'day-card__city');
    const cityIcon = el('span', 'day-card__city-icon', '📍');
    cityIcon.setAttribute('aria-hidden', 'true');
    cityRow.appendChild(cityIcon);
    cityRow.appendChild(document.createTextNode(day.city));
    link.appendChild(cityRow);

    if (day.summary) {
      link.appendChild(el('p', 'day-card__summary', day.summary));
    }

    const badges = el('div', 'day-card__badges');

    if (isToday) {
      badges.appendChild(el('span', 'day-card__badge day-card__badge--today', 'Oggi'));
    }

    const status = el(
      'span',
      day.detailStatus === 'placeholder'
        ? 'day-card__badge day-card__status--placeholder'
        : 'day-card__badge',
      day.detailStatus === 'placeholder' ? 'Da completare' : 'Dettagli disponibili',
    );
    badges.appendChild(status);

    if (Array.isArray(day.items) && day.items.length > 0) {
      const { done, total } = countProgress(tripId, day.items);
      badges.appendChild(
        el('span', 'day-card__badge day-card__badge--progress', `${done}/${total} completate`),
      );
    }

    link.appendChild(badges);

    li.appendChild(link);
    list.appendChild(li);
  }

  section.appendChild(list);
  mainEl.appendChild(section);
  mainEl.focus();

  // Wire search filtering after the list is in the DOM.
  const cards = Array.from(list.querySelectorAll('.day-card'));
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;
    for (const card of cards) {
      const matches = query === '' || (card.dataset.searchText || '').includes(query);
      card.closest('li').hidden = !matches;
      if (matches) visibleCount += 1;
    }
    searchResults.textContent =
      query === '' ? '' : `${visibleCount} giornata/e su ${cards.length} trovate.`;
  });
}

/** Build a lightweight, accessible progress bar with a visible text fallback. */
function buildProgressBar(done, total, label) {
  const wrap = el('div', 'progress');
  wrap.dataset.label = label;
  wrap.appendChild(el('p', 'progress__label', `${label}: ${done}/${total} tappe completate`));
  const track = el('div', 'progress__track');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', String(total));
  track.setAttribute('aria-valuenow', String(done));
  track.setAttribute('aria-label', label);
  const fill = el('div', 'progress__fill');
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  fill.style.width = `${pct}%`;
  track.appendChild(fill);
  wrap.appendChild(track);
  return wrap;
}

/** Update an existing progress bar node in place (no re-render, keeps scroll position). */
function updateProgressBar(wrap, done, total) {
  if (!wrap) return;
  const label = wrap.dataset.label || '';
  const labelEl = wrap.querySelector('.progress__label');
  if (labelEl) labelEl.textContent = `${label}: ${done}/${total} tappe completate`;
  const track = wrap.querySelector('.progress__track');
  if (track) {
    track.setAttribute('aria-valuemax', String(total));
    track.setAttribute('aria-valuenow', String(done));
    const fill = track.querySelector('.progress__fill');
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    if (fill) fill.style.width = `${pct}%`;
  }
}


// ---------- Rendering: day detail ----------

function renderDay(tripId, itinerary, dayId) {
  clear(mainEl);
  const { days } = itinerary;
  const index = days.findIndex((d) => d.id === dayId);

  if (index === -1) {
    const err = el('div', 'error', 'Giornata non trovata.');
    const backLink = el('p');
    const a = el('a', null, 'Torna all’indice del viaggio');
    a.href = `#/trip/${tripId}`;
    backLink.appendChild(a);
    err.appendChild(backLink);
    mainEl.appendChild(err);
    return;
  }

  const day = days[index];
  const prev = index > 0 ? days[index - 1] : null;
  const next = index < days.length - 1 ? days[index + 1] : null;
  const todayId = getTodayIsoDate();

  const article = el('article', 'day');
  article.setAttribute('aria-labelledby', 'day-title');

  // Navigation
  const nav = el('nav', 'day-nav');
  nav.setAttribute('aria-label', 'Navigazione tra le giornate');

  const tripsBtn = el('a', 'day-nav__btn', 'Viaggi');
  tripsBtn.href = '#/';
  nav.appendChild(tripsBtn);

  const prevBtn = el('a', 'day-nav__btn', '← Precedente');
  if (prev) {
    prevBtn.href = `#/trip/${tripId}/day/${prev.id}`;
  } else {
    prevBtn.setAttribute('aria-disabled', 'true');
    prevBtn.href = `#/trip/${tripId}`;
  }
  nav.appendChild(prevBtn);

  const todayBtn = el('a', 'day-nav__btn', 'Oggi');
  if (days.some((d) => d.id === todayId)) {
    todayBtn.href = `#/trip/${tripId}/day/${todayId}`;
    if (day.id === todayId) todayBtn.setAttribute('aria-current', 'date');
  } else {
    todayBtn.setAttribute('aria-disabled', 'true');
    todayBtn.href = `#/trip/${tripId}`;
  }
  nav.appendChild(todayBtn);

  const indexBtn = el('a', 'day-nav__btn', 'Indice');
  indexBtn.href = `#/trip/${tripId}`;
  nav.appendChild(indexBtn);

  const nextBtn = el('a', 'day-nav__btn', 'Successivo →');
  if (next) {
    nextBtn.href = `#/trip/${tripId}/day/${next.id}`;
  } else {
    nextBtn.setAttribute('aria-disabled', 'true');
    nextBtn.href = `#/trip/${tripId}`;
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

  const hasItems = Array.isArray(day.items) && day.items.length > 0;
  let dayProgressBar = null;

  if (hasItems) {
    const strip = buildTransportStrip(day.items);
    if (strip) header.appendChild(strip);
    const { done, total } = countProgress(tripId, day.items);
    dayProgressBar = buildProgressBar(done, total, 'Tappe della giornata');
    header.appendChild(dayProgressBar);
    const stats = buildDayStats(day.items);
    if (stats) header.appendChild(stats);
  }

  article.appendChild(header);

  // Body
  if (!hasItems) {
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
    article.appendChild(buildCategoryFilter(day.items));
    const nextUpId = day.id === todayId ? computeNextUpId(tripId, day.items) : null;
    const onToggle = () => {
      const { done, total } = countProgress(tripId, day.items);
      updateProgressBar(dayProgressBar, done, total);
    };
    article.appendChild(renderTimeline(tripId, day.items, { nextUpId, onToggle }));
    wireSwipeNavigation(tripId, article, prev, next);
  }

  mainEl.appendChild(article);
  mainEl.focus();
}

/** ID of the next not-yet-completed item whose time is >= now (today's view only). */
function computeNextUpId(tripId, items) {
  const completed = getCompletedMap(tripId);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (const item of items) {
    if (completed[item.id]) continue;
    if (!item.time) continue;
    const [h, m] = item.time.split(':').map(Number);
    if (Number.isFinite(h) && Number.isFinite(m) && h * 60 + m >= nowMinutes) {
      return item.id;
    }
  }
  return null;
}

/** Aggregate transfer/visit minutes and cost (grouped by currency) for a day. */
function buildDayStats(items) {
  let transferMinutes = 0;
  let visitMinutes = 0;
  let sawNullTransfer = false;
  let sawNullDuration = false;
  const costByCurrency = new Map();
  const estimatedCurrencies = new Set();
  let sawNullCost = false;

  for (const item of items) {
    if (item.transferFromPrevious) {
      if (item.transferFromPrevious.durationMinutes != null) {
        transferMinutes += item.transferFromPrevious.durationMinutes;
      } else {
        sawNullTransfer = true;
      }
    }
    if (item.durationMinutes != null) {
      visitMinutes += item.durationMinutes;
    } else if (item.type !== 'transport') {
      sawNullDuration = true;
    }
    if (item.cost && item.cost.amount != null && item.cost.currency) {
      const prevAmount = costByCurrency.get(item.cost.currency) || 0;
      costByCurrency.set(item.cost.currency, prevAmount + item.cost.amount);
      if (item.cost.estimated) estimatedCurrencies.add(item.cost.currency);
    } else if (item.type !== 'transport') {
      sawNullCost = true;
    }
  }

  const parts = [];
  parts.push(`Spostamenti: ${transferMinutes} min${sawNullTransfer ? ' (stima parziale)' : ''}`);
  parts.push(`Visite: ${visitMinutes} min${sawNullDuration ? ' (stima parziale)' : ''}`);
  if (costByCurrency.size > 0) {
    const costText = Array.from(costByCurrency.entries())
      .map(([currency, amount]) => `${amount} ${currency}${estimatedCurrencies.has(currency) ? ' \u2248' : ''}`)
      .join(' + ');
    parts.push(`Costo: ${costText}${sawNullCost ? ' (stima parziale)' : ''}`);
  }

  return el('p', 'day-header__stats', parts.join(' · '));
}

/**
 * One-line "what am I riding today" chain built from each item's transfer
 * (e.g. "🚕 → 🚌 240 → 🚶 → 🚌 240 → 🚕"). Tapping it scrolls to the first
 * transfer connector in the timeline.
 */
function buildTransportStrip(items) {
  const transfers = items
    .map((item) => item.transferFromPrevious)
    .filter((t) => t && t.mode);
  if (transfers.length === 0) return null;

  const btn = el('button', 'transport-strip');
  btn.type = 'button';
  const chainText = transfers
    .map((t) => (t.line ? `${iconForTransferMode(t.mode)} ${t.line}` : iconForTransferMode(t.mode)))
    .join(' \u2192 ');
  btn.textContent = chainText;
  btn.setAttribute(
    'aria-label',
    `Spostamenti della giornata: ${transfers.map((t) => labelForTransferMode(t.mode)).join(', ')}. Tocca per andare al primo spostamento.`,
  );
  btn.addEventListener('click', () => {
    const target = document.getElementById('first-transfer-connector');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  return btn;
}

/** Checkbox chips to filter the timeline by item type. Session-only, not persisted. */
function buildCategoryFilter(items) {
  const typesPresent = Array.from(new Set(items.map((item) => item.type || 'visit')));
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'category-filter';
  const legend = document.createElement('legend');
  legend.className = 'category-filter__legend';
  legend.textContent = 'Filtra per categoria';
  fieldset.appendChild(legend);

  for (const type of typesPresent) {
    const label = el('label', 'category-filter__chip');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.className = 'category-filter__checkbox';
    checkbox.dataset.type = type;
    checkbox.addEventListener('change', () => {
      document
        .querySelectorAll(`.timeline-item--${type}`)
        .forEach((node) => {
          node.hidden = !checkbox.checked;
        });
    });
    label.appendChild(checkbox);
    const icon = el('span', 'category-filter__icon', iconForType(type));
    icon.setAttribute('aria-hidden', 'true');
    label.appendChild(icon);
    label.appendChild(document.createTextNode(labelForType(type)));
    fieldset.appendChild(label);
  }

  return fieldset;
}

/** Left/right swipe on the day article navigates to the previous/next day. */
function wireSwipeNavigation(tripId, articleEl, prevDay, nextDay) {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  articleEl.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) return;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    tracking = true;
  });

  articleEl.addEventListener('touchend', (event) => {
    if (!tracking) return;
    tracking = false;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    if (deltaX < 0 && nextDay) {
      window.location.hash = `#/trip/${tripId}/day/${nextDay.id}`;
    } else if (deltaX > 0 && prevDay) {
      window.location.hash = `#/trip/${tripId}/day/${prevDay.id}`;
    }
  });
}


/**
 * Render the connector between the previous item and this one: mode icon,
 * line, duration, frequency, fare, T-money/estimate chips, from → to stops
 * (with local script names), any free-text notes, and booking/Naver buttons
 * when the corresponding data is present. All fields are optional (schema v2
 * is backward compatible with the legacy `{ mode, durationMinutes, notes }`
 * shape).
 */
function renderTransferConnector(t) {
  const mode = t.mode || null;
  const wrap = el('div', `transfer-connector${mode ? ` transfer-connector--${mode}` : ''}`);

  const summary = el('p', 'transfer-connector__summary');
  const icon = el('span', 'transfer-connector__icon', iconForTransferMode(mode));
  icon.setAttribute('aria-hidden', 'true');
  summary.appendChild(icon);

  const modeLabel = mode ? labelForTransferMode(mode) : null;
  const headline = t.line
    ? `${capitalize(modeLabel) || 'Trasferimento'} ${t.line}`
    : capitalize(modeLabel) || 'Spostamento dalla tappa precedente';
  summary.appendChild(document.createTextNode(headline));

  const metaParts = [];
  if (t.durationMinutes != null) metaParts.push(`${t.durationMinutes} min`);
  if (t.frequency) metaParts.push(t.frequency);
  const fareText = formatMoney(t.fare);
  if (fareText) metaParts.push(fareText);
  if (metaParts.length > 0) {
    summary.appendChild(document.createTextNode(` \u00b7 ${metaParts.join(' \u00b7 ')}`));
  }
  wrap.appendChild(summary);

  const chips = [];
  if (t.tmoney === true) chips.push(['chip--tmoney-yes', 'T-money \u2713']);
  else if (t.tmoney === false) chips.push(['chip--tmoney-no', 'T-money \u2717']);
  if (t.estimated || (t.fare && t.fare.estimated)) chips.push(['chip--estimate', '\u2248 stima']);
  if (chips.length > 0) {
    const chipsWrap = el('div', 'transfer-connector__chips');
    for (const [modifierClass, label] of chips) {
      chipsWrap.appendChild(el('span', `chip ${modifierClass}`, label));
    }
    wrap.appendChild(chipsWrap);
  }

  const routeText = [formatStop(t.from), formatStop(t.to)].filter(Boolean).join(' \u2192 ');
  if (routeText) {
    wrap.appendChild(el('p', 'transfer-connector__route', routeText));
  }

  if (t.notes) {
    wrap.appendChild(el('p', 'transfer-connector__notes', t.notes));
  }

  const actions = [];
  if (t.booking && t.booking.url) {
    actions.push({ href: t.booking.url, label: t.booking.label || 'Prenota' });
  }
  const naverUrl = buildNaverMapsUrl(t);
  if (naverUrl) actions.push({ href: naverUrl, label: 'Naver' });
  if (actions.length > 0) {
    const actionsWrap = el('div', 'transfer-connector__actions');
    for (const action of actions) {
      const link = el('a', 'transfer-connector__btn', action.label);
      link.href = action.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      actionsWrap.appendChild(link);
    }
    wrap.appendChild(actionsWrap);
  }

  return wrap;
}

function renderTimeline(tripId, items, options = {}) {
  const { nextUpId = null, onToggle = null } = options;
  const list = el('ol', 'timeline');
  list.setAttribute('aria-label', 'Tappe della giornata');

  const completed = getCompletedMap(tripId);
  let firstTransferSeen = false;

  for (const item of items) {
    const type = item.type || 'visit';
    const li = el('li', `timeline-item timeline-item--${type}`);
    if (completed[item.id]) li.classList.add('timeline-item--done');
    if (nextUpId === item.id) li.classList.add('timeline-item--next');

    // Transfer from previous (rendered above the item's own info)
    if (item.transferFromPrevious) {
      const connector = renderTransferConnector(item.transferFromPrevious);
      if (!firstTransferSeen) {
        connector.id = 'first-transfer-connector';
        firstTransferSeen = true;
      }
      li.appendChild(connector);
    }

    if (nextUpId === item.id) {
      li.appendChild(el('span', 'timeline-item__next-badge', 'Prossima tappa'));
    }

    const timeLine = el('p', 'timeline-item__time', item.time || '—');
    const typeBadge = el('span', 'timeline-item__type');
    const icon = el('span', 'timeline-item__icon', iconForType(type));
    icon.setAttribute('aria-hidden', 'true');
    typeBadge.appendChild(icon);
    typeBadge.appendChild(document.createTextNode(labelForType(type)));
    timeLine.appendChild(typeBadge);
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

    const costText = formatMoney(item.cost);
    if (costText) {
      li.appendChild(
        el('p', 'timeline-item__meta', `Costo: ${costText}${item.cost.estimated ? ' ≈' : ''}`),
      );
    }

    if (Array.isArray(item.notes) && item.notes.length > 0) {
      const notesList = el('ul', 'timeline-item__notes');
      for (const note of item.notes) {
        notesList.appendChild(el('li', null, note));
      }
      li.appendChild(notesList);
    }

    if (item.status === 'uncertain') {
      li.appendChild(el('span', 'timeline-item__uncertain', 'Da verificare'));
      if (item.sourceText) {
        li.appendChild(
          el('p', 'timeline-item__source-text', `Testo originale: «${item.sourceText}»`),
        );
      }
    }

    const mapUrl = buildGoogleMapsSearchUrl(item.location);
    if (mapUrl) {
      const a = el('a', 'timeline-item__map-link', 'Apri nella mappa');
      a.href = mapUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      li.appendChild(a);
    }

    const doneLabel = el('label', 'timeline-item__done-toggle');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'timeline-item__checkbox';
    checkbox.checked = Boolean(completed[item.id]);
    checkbox.addEventListener('change', () => {
      setItemCompleted(tripId, item.id, checkbox.checked);
      li.classList.toggle('timeline-item--done', checkbox.checked);
      if (onToggle) onToggle();
    });
    doneLabel.appendChild(checkbox);
    doneLabel.appendChild(document.createTextNode('Completata'));
    li.appendChild(doneLabel);

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
  // Expected forms: "#/", "#/trip/korea-2026", "#/trip/korea-2026/day/2026-07-26"
  if (hash === '#/' || hash === '#' || hash === '') {
    return { route: 'picker' };
  }
  const dayMatch = hash.match(/^#\/trip\/([a-z0-9-]+)\/day\/(\d{4}-\d{2}-\d{2})$/);
  if (dayMatch) {
    return { route: 'day', tripId: dayMatch[1], dayId: dayMatch[2] };
  }
  const tripMatch = hash.match(/^#\/trip\/([a-z0-9-]+)$/);
  if (tripMatch) {
    return { route: 'tripHome', tripId: tripMatch[1] };
  }
  return { route: 'unknown' };
}

/** Shows/hides and populates the footer's trip-scoped bits (last-updated date, reset button) and the header's trip-context line. */
function updateFooterForTrip(tripId, itinerary) {
  if (!tripId || !itinerary) {
    if (lastUpdatedEl) lastUpdatedEl.textContent = '';
    if (resetCompletedEl) resetCompletedEl.hidden = true;
    if (tripContextEl) tripContextEl.textContent = '';
    return;
  }
  const trip = itinerary.trip;
  if (lastUpdatedEl && trip && trip.lastUpdated) {
    lastUpdatedEl.textContent = `Ultimo aggiornamento dati: ${trip.lastUpdated}`;
  }
  if (resetCompletedEl) resetCompletedEl.hidden = false;
  if (tripContextEl && trip) {
    tripContextEl.textContent =
      `${trip.title} · ${formatDateShort(trip.startDate)} – ${formatDateShort(trip.endDate)} ${trip.endDate.slice(0, 4)}`;
  }
}

async function render() {
  if (state.error) {
    clear(mainEl);
    const err = el(
      'div',
      'error',
      `Impossibile caricare i viaggi: ${state.error}`,
    );
    mainEl.appendChild(err);
    updateFooterForTrip(null, null);
    return;
  }
  if (!state.tripsIndex) return;

  const hashAtStart = window.location.hash || '#/';
  const parsed = parseHash();

  if (parsed.route === 'unknown') {
    window.location.hash = '#/';
    return;
  }

  if (parsed.route === 'picker') {
    state.currentTripId = null;
    renderTripPicker(state.tripsIndex);
    updateFooterForTrip(null, null);
    window.scrollTo(0, 0);
    return;
  }

  // tripHome or day: the trip must exist in the index, and its data may need
  // to be lazily fetched on first visit.
  const tripId = parsed.tripId;
  const entry = state.tripsIndex.find((t) => t.id === tripId);
  if (!entry) {
    clear(mainEl);
    const err = el('div', 'error', 'Viaggio non trovato.');
    const backP = el('p');
    const a = el('a', null, 'Torna ai viaggi');
    a.href = '#/';
    backP.appendChild(a);
    err.appendChild(backP);
    mainEl.appendChild(err);
    state.currentTripId = null;
    updateFooterForTrip(null, null);
    return;
  }

  let itinerary;
  try {
    if (!state.trips.has(tripId)) {
      clear(mainEl);
      mainEl.appendChild(el('p', 'loading', 'Caricamento itinerario…'));
    }
    itinerary = await loadTrip(tripId);
  } catch (err) {
    clear(mainEl);
    mainEl.appendChild(
      el('div', 'error', `Impossibile caricare il viaggio: ${err.message || err}`),
    );
    state.currentTripId = null;
    updateFooterForTrip(null, null);
    return;
  }

  // If the hash changed again while the fetch above was in flight, a newer
  // render() call already owns the current route — bail out to avoid a
  // stale render clobbering it.
  if ((window.location.hash || '#/') !== hashAtStart) return;

  state.currentTripId = tripId;
  updateFooterForTrip(tripId, itinerary);

  if (parsed.route === 'day') {
    renderDay(tripId, itinerary, parsed.dayId);
  } else {
    renderTripHome(tripId, itinerary);
  }
  window.scrollTo(0, 0);
}

// ---------- Theme ----------

const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const THEME_COLORS = { light: '#b42318', dark: '#1c1a17' };

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (themeToggleEl) {
    const isDark = theme === 'dark';
    themeToggleEl.setAttribute('aria-pressed', String(isDark));
    themeToggleEl.setAttribute('aria-label', isDark ? 'Attiva tema chiaro' : 'Attiva tema scuro');
    themeToggleEl.textContent = '';
    const icon = el('span', null, isDark ? '☀️' : '🌙');
    icon.setAttribute('aria-hidden', 'true');
    themeToggleEl.appendChild(icon);
  }
  if (themeColorMeta) themeColorMeta.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.light);
}

function initTheme() {
  const stored = getTheme();
  const preferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
  applyTheme(stored || preferred);

  if (themeToggleEl) {
    themeToggleEl.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      setTheme(next);
    });
  }
}

// ---------- Reset completed items ----------

function initResetCompleted() {
  if (!resetCompletedEl) return;
  resetCompletedEl.addEventListener('click', () => {
    if (!state.currentTripId) return;
    const confirmed = window.confirm(
      'Azzerare tutte le tappe completate di questo viaggio? L’operazione non può essere annullata.',
    );
    if (!confirmed) return;
    resetCompleted(state.currentTripId);
    render();
  });
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
  // Captured before registering: true only if this page load was already being
  // controlled by a previously installed worker. Used to tell a real update
  // apart from the very first install (where there is no controller yet).
  const hadControllerAtLoad = Boolean(navigator.serviceWorker.controller);
  window.addEventListener('load', () => {
    navigator.serviceWorker
      // updateViaCache: 'none' forces the browser to always bypass its HTTP
      // cache when checking sw.js for changes, instead of trusting
      // Cache-Control/max-age from the static host (e.g. GitHub Pages),
      // which would otherwise delay update detection by several minutes.
      .register('./sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        watchForUpdates(registration, hadControllerAtLoad);
        // Browsers only auto-check for a new sw.js on navigation, and only
        // about once every 24h. Visitors who reopen an installed/pinned app
        // without a full navigation (or who load it more than once in a day)
        // could otherwise be stuck on a stale version indefinitely.
        // registration.update() is an explicit check and isn't subject to
        // that throttle, so trigger it right away, whenever the app comes
        // back to the foreground, and periodically while it stays open.
        registration.update().catch(() => {});
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      })
      .catch((err) => {
        console.warn('Registrazione Service Worker fallita:', err);
      });
  });
}

/**
 * Reloads the page once a new service worker version has taken control.
 * The new version activates itself automatically (see `skipWaiting()` in
 * sw.js's install handler), so this no longer needs a manual "Aggiorna"
 * click to reach visitors who won't notice or understand a technical
 * banner — it briefly shows a status message, then reloads.
 */
function watchForUpdates(registration, hadControllerAtLoad) {
  if (!hadControllerAtLoad) return; // First install: nothing to update yet.

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    if (updateBannerEl) updateBannerEl.hidden = false;
    window.location.reload();
  });
}

// ---------- Bootstrap ----------

async function init() {
  window.addEventListener('hashchange', render);
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  updateConnectionStatus();
  initTheme();
  initResetCompleted();

  try {
    const data = await fetchJson(TRIPS_INDEX_URL);
    state.tripsIndex = Array.isArray(data.trips) ? data.trips : [];
  } catch (err) {
    state.error = err.message || String(err);
  }
  render();
  registerServiceWorker();
}

init();

