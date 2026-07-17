// Corea 2026 — main application module (vanilla ES module).
// - Loads itinerary from ./data/itinerary.json
// - Hash router: #/ (home) and #/day/YYYY-MM-DD (day detail)
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

const DATA_URL = './data/itinerary.json';

const state = {
  itinerary: null,
  error: null,
};

const mainEl = document.getElementById('main');
const connectionStatusEl = document.getElementById('connection-status');
const lastUpdatedEl = document.getElementById('last-updated');
const themeToggleEl = document.getElementById('theme-toggle');
const resetCompletedEl = document.getElementById('reset-completed');
const updateBannerEl = document.getElementById('update-banner');
const updateBannerBtnEl = document.getElementById('update-banner__btn');

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

/** Count of completed vs total items across a list of items. */
function countProgress(items) {
  const completed = getCompletedMap();
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
  const todayId = getTodayIsoDate();

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

  // Trip-wide progress
  const allItems = getAllItems(days);
  if (allItems.length > 0) {
    const { done, total } = countProgress(allItems);
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
      window.location.hash = `#/day/${todayId}`;
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
    link.href = `#/day/${day.id}`;
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
      const { done, total } = countProgress(day.items);
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
  const todayId = getTodayIsoDate();

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

  const todayBtn = el('a', 'day-nav__btn', 'Oggi');
  if (days.some((d) => d.id === todayId)) {
    todayBtn.href = `#/day/${todayId}`;
    if (day.id === todayId) todayBtn.setAttribute('aria-current', 'date');
  } else {
    todayBtn.setAttribute('aria-disabled', 'true');
    todayBtn.href = '#/';
  }
  nav.appendChild(todayBtn);

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

  const hasItems = Array.isArray(day.items) && day.items.length > 0;
  let dayProgressBar = null;

  if (hasItems) {
    const { done, total } = countProgress(day.items);
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
    const nextUpId = day.id === todayId ? computeNextUpId(day.items) : null;
    const onToggle = () => {
      const { done, total } = countProgress(day.items);
      updateProgressBar(dayProgressBar, done, total);
    };
    article.appendChild(renderTimeline(day.items, { nextUpId, onToggle }));
    wireSwipeNavigation(article, prev, next);
  }

  mainEl.appendChild(article);
  mainEl.focus();
}

/** ID of the next not-yet-completed item whose time is >= now (today's view only). */
function computeNextUpId(items) {
  const completed = getCompletedMap();
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
    } else if (item.type !== 'transport') {
      sawNullCost = true;
    }
  }

  const parts = [];
  parts.push(`Spostamenti: ${transferMinutes} min${sawNullTransfer ? ' (stima parziale)' : ''}`);
  parts.push(`Visite: ${visitMinutes} min${sawNullDuration ? ' (stima parziale)' : ''}`);
  if (costByCurrency.size > 0) {
    const costText = Array.from(costByCurrency.entries())
      .map(([currency, amount]) => `${amount} ${currency}`)
      .join(' + ');
    parts.push(`Costo: ${costText}${sawNullCost ? ' (stima parziale)' : ''}`);
  }

  return el('p', 'day-header__stats', parts.join(' · '));
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
function wireSwipeNavigation(articleEl, prevDay, nextDay) {
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
      window.location.hash = `#/day/${nextDay.id}`;
    } else if (deltaX > 0 && prevDay) {
      window.location.hash = `#/day/${prevDay.id}`;
    }
  });
}


function renderTimeline(items, options = {}) {
  const { nextUpId = null, onToggle = null } = options;
  const list = el('ol', 'timeline');
  list.setAttribute('aria-label', 'Tappe della giornata');

  const completed = getCompletedMap();

  for (const item of items) {
    const type = item.type || 'visit';
    const li = el('li', `timeline-item timeline-item--${type}`);
    if (completed[item.id]) li.classList.add('timeline-item--done');
    if (nextUpId === item.id) li.classList.add('timeline-item--next');

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

    const doneLabel = el('label', 'timeline-item__done-toggle');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'timeline-item__checkbox';
    checkbox.checked = Boolean(completed[item.id]);
    checkbox.addEventListener('change', () => {
      setItemCompleted(item.id, checkbox.checked);
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
    const confirmed = window.confirm(
      'Azzerare tutte le tappe completate? L’operazione non può essere annullata.',
    );
    if (!confirmed) return;
    resetCompleted();
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
      .register('./sw.js')
      .then((registration) => {
        watchForUpdates(registration, hadControllerAtLoad);
      })
      .catch((err) => {
        console.warn('Registrazione Service Worker fallita:', err);
      });
  });
}

/** Shows a non-intrusive "update available" banner instead of forcing a reload. */
function watchForUpdates(registration, hadControllerAtLoad) {
  if (!hadControllerAtLoad) return; // First install: nothing to update yet.

  const showBanner = (worker) => {
    if (!updateBannerEl) return;
    updateBannerEl.hidden = false;
    if (updateBannerBtnEl) {
      updateBannerBtnEl.addEventListener(
        'click',
        () => {
          worker.postMessage({ type: 'SKIP_WAITING' });
        },
        { once: true },
      );
    }
  };

  if (registration.waiting) {
    showBanner(registration.waiting);
  }

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    const checkState = () => {
      if (installing.state === 'installed') showBanner(installing);
    };
    installing.addEventListener('statechange', checkState);
    checkState(); // Covers the case where 'installed' was reached before we attached the listener.
  });

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
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

