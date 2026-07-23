---
description: "Rules for entering/editing the real trip data under data/trips/"
applyTo: "data/trips/**"
---

# Rules for `data/trips/`

This app supports multiple trips. `data/trips/index.json` lists every trip
(`{id, title, startDate, endDate, summary, dataUrl}`); each trip's actual
itinerary content lives in its own file, `data/trips/<id>.json`, in the same
shape documented below. Follow these rules whenever you add, correct, or
complete trip data. See [SPEC.md](../../SPEC.md) section 6 ("Modello dati")
and section 7 ("Contenuto iniziale") for the full background — this file
summarizes the operational rules to apply directly to the JSON.

## `data/trips/index.json`

- One entry per trip, keep in sync with the files on disk: every entry's
  `id` must match an existing `data/trips/<id>.json` file, and every trip
  file must have a corresponding entry here.
- `id`: kebab-case, unique, matches the trip's filename (e.g. `china-2025` ->
  `data/trips/china-2025.json`). Once a trip has been published/used, do not
  rename its `id` (it is also used as the localStorage namespace for
  completed-item state).
- `startDate`/`endDate`: ISO `YYYY-MM-DD`, must match the trip file's own
  `trip.startDate`/`trip.endDate`.
- `summary`: short factual one-liner (e.g. main cities visited in order).
  Do not invent flavor text beyond what's actually in the trip's data.
- `dataUrl`: relative path to the trip's JSON file, e.g.
  `"./data/trips/china-2025.json"`.
- Do not add a stored "status" (upcoming/past) field — the app computes this
  at render time from today's date vs the trip's date range.

## Golden rules

- **Never invent missing information.** If a detail (time, cost, name,
  coordinates, transfer mode…) is not known from the real trip notes/photos,
  leave it as `null` (or `detailStatus`/`status`/`items: []` as appropriate).
  Do not guess durations, prices, or opening hours to "fill gaps".
- **Never add secrets or personal data.** No booking references, confirmation
  numbers, ticket codes, passport/ID info, payment details, phone numbers, or
  addresses of private accommodation contacts.
- **JSON must stay valid** after every edit. Validate with:
  `Get-Content -Raw data/trips/<id>.json | ConvertFrom-Json` (PowerShell) —
  and `data/trips/index.json` the same way — before considering a change done.
- **Use `null`, not empty strings**, for unknown scalar values (e.g.
  `"cost": null`, not `"cost": ""`).
- **Keep every `id` stable and unique.** Once published, do not change an
  existing `id` — other code/state (e.g. completed-steps in `localStorage`)
  may reference it.

## Top-level `trip` object

- `id`: kebab-case, unique across all trips, must match the filename
  (`data/trips/<id>.json`) and the corresponding entry in
  `data/trips/index.json`. Once published, do not change it.
- `title`: short display title for the trip (e.g. `"Corea 2026"`).
- `startDate` / `endDate`: ISO `YYYY-MM-DD`, must match the actual trip range.
- `timezone`: IANA name, e.g. `"Asia/Seoul"`.
- `lastUpdated`: ISO `YYYY-MM-DD`. **Update this every time you change trip
  content.**
- `contentStatus`: `"partial"` while any day still has `detailStatus:
  "placeholder"`; set to `"complete"` only when every day has real, verified
  items.

## Optional `food` catalog

The optional top-level `food` object is a country-wide checklist. Its dishes
are public itinerary content; the choice of a daily dish, the "tried"
checkbox, the personal 1-5 star rating and the free-text comment are
intentionally stored only in the visitor's `localStorage` and must never be
added to the JSON.

```json
"food": {
  "dishes": [
    {
      "id": "dish-example-one",
      "name": "Replace with the verified dish name",
      "description": "Replace with a factual description.",
      "status": "transcribed",
      "food-type": "vegetarian"
    }
  ],
  "cities": [
    {
      "id": "city-example",
      "name": "Replace with the city name",
      "itineraryCityNames": ["Exact days[].city value"],
      "dishIds": ["dish-example-one"]
    }
  ]
}
```

The example is a template only. Replace every value with real, sourced trip
content before adding it to a trip file.

- `dishes` is the canonical national catalog. Every entry needs a stable,
  unique kebab-case `id`, plus `name`, `description` and `status`.
- `food-type` (optional, kebab-case key — read in JS as `dish['food-type']`):
  drives a badge/color in the food view, analogous to `type` for items. Only
  two values are allowed: `vegetarian` (vegetarian dish, or easily adapted to
  a veg version) and `classic` (traditional dish with meat, fish or
  seafood). Omit the field if not known — do not guess. Missing or unknown
  values fall back to no badge (neutral, non-breaking); this field is
  additive and trips without it keep working unchanged.
- Use `status: "uncertain"` and preserve unclear source wording in
  `sourceText`; do not replace uncertain information with a guess.
- `cities` groups dishes by availability or typicity. Each city needs a
  unique stable `id`, display `name`, exact `itineraryCityNames` copied from
  one or more `days[].city` values, and `dishIds` pointing to existing dishes.
- A day-city name can belong to only one food city. A dish can be referenced
  from multiple cities without duplicating its catalog entry.
- A dish may be absent from every `cities[].dishIds`; it remains part of the
  national goal and is shown as an "other country dish" in the UI.
- Never invent dishes, descriptions, city associations or regional claims.
  Leave `food` absent until there is a real source to transcribe.
- Update `trip.lastUpdated` whenever the food catalog changes, then validate
  the whole JSON with the PowerShell command below.

## `days[]` entries

One entry per calendar day of the trip, in chronological order, with no gaps.

| Field | Rules |
|---|---|
| `id` | Same value as `date` (`YYYY-MM-DD`). |
| `dayNumber` | 1-based sequential index across the whole trip. |
| `date` | ISO `YYYY-MM-DD`. |
| `city` | Main city/base for that day. |
| `summary` | Short one-line description, or `null` if not yet known. |
| `transferSummary` | Human-readable "A → mode → B" string if the day involves a city change, otherwise `null`. |
| `detailStatus` | `"transcribed"` once real `items` have been entered and cross-checked against source notes/photos; `"placeholder"` if `items` is still `[]` (general itinerary only, no hour-by-hour detail yet). |
| `items` | `[]` for placeholder days. Never fabricate items to avoid an empty array. |

## `items[]` entries (per day)

Each stop/activity in a day's timeline:

- `id`: unique, stable, pattern `YYYY-MM-DD-slug` (kebab-case, ASCII).
- `time`: `HH:mm` 24h local time, or `null` if unknown.
- `type`: one of `visit`, `transport`, `market`, `meal`, `hotel`, `optional`
  (these six values drive icons/colors in the UI — do not invent new ones
  without also updating `assets/js/app.js` and `assets/css/app.css`).
- `title`: short name of the stop.
- `description`: free text detail, or `null`.
- `durationMinutes`: integer minutes of visit/activity duration, or `null`.
  Keep this separate from transfer time (see `transferFromPrevious`).
- `cost`: `null`, or an object `{ "amount": number, "currency": "EUR", "display": "€9" }` — only when the amount is actually known/confirmed.
  Optional `"estimated": true` (schema v2) marks a planning estimate rather
  than a confirmed price; the UI shows a neutral "≈" marker for it.
- `status`: one of `confirmed`, `transcribed`, `uncertain`, `placeholder`.
  - Use `uncertain` when the source text/photo is ambiguous or hard to read;
    also fill `sourceText` with the original (dubious) wording in that case.
  - Do not upgrade `uncertain` → `confirmed` without actually verifying
    against the original source.
- `location`: see below.
- `transferFromPrevious`: `null` for the first item of the day or when there
  is no transfer, otherwise `{ "mode": ..., "durationMinutes": ..., "notes": ... }`.
  - `mode`: one of `walk`, `subway`, `train`, `bus`, `taxi`, `car`, `plane`, `ferry`.
  - Schema v2 (optional, backward compatible — see [SPEC.md](../../SPEC.md)
    §6.2): may also include `line`, `from`/`to` (`{ name, nameLocal }`),
    `frequency`, `fare` (money object), `tmoney` (`true`/`false`/`null`),
    `booking` (`{ label, url }`, `url` must be `https:`; only for intercity
    bus/train/plane bookings — city buses/metro use `tmoney` instead),
    `naverQuery`, and `estimated`. Only fill fields you can actually
    transcribe from the source notes — leave them absent/`null` rather than
    guessing. Set `estimated: true` only for planning estimates that are
    explicitly not yet verified on the ground; never silently upgrade an
    estimate to a confirmed fact.
- `notes`: array of strings for extra unstructured remarks; `[]` if none.

### `location` object

- `name`: place name as used for display.
- `city`, `country`: plain strings.
- `latitude` / `longitude`: numbers only if actually verified; otherwise `null`
  (do not approximate coordinates).
- `googleMapsQuery`: a text search query usable to open the place in Google
  Maps (name + city is usually enough).
- `naverMapsUrl`: `null` unless a specific Naver Map URL is available.
- `verificationStatus`: `"verified"` only if coordinates/name have been
  cross-checked against an authoritative map; otherwise `"unverified"`.

## Workflow for filling in real data

1. Work day by day, in trip order, transcribing from the original source
   (notes/photos) without correcting or inferring beyond what's written.
2. Fill every field you can confirm; leave the rest `null`.
3. If a piece of text is unclear, set `status: "uncertain"`, keep the literal
   text in `sourceText`, and do **not** silently pick your best guess as the
   final value.
4. Once a day's `items` are entered, set that day's `detailStatus` to
   `"transcribed"`.
5. Update `trip.lastUpdated` to the date of the edit.
6. Re-run the JSON validation command above and check the app locally
   (hash routes like `./#/trip/<id>/day/YYYY-MM-DD`) before committing.
7. Do not remove or rewrite the "still to verify" list in
   [SPEC.md](../../SPEC.md) section 7.3 — update it only when an item is
   actually resolved.
