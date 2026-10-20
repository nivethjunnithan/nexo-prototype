<p align="center">
  <img src="public/nexo-mark.svg" alt="Nexo logo: a glowing cyan geometric N" width="88" height="88" />
</p>

<h1 align="center">Nexo</h1>

<p align="center"><strong>Your place. Your plan.</strong><br />A destination-first trip planner that turns a city, a date, and a few interests into a practical guide for the days ahead.</p>

<p align="center">
  <img alt="Responsive web app" src="https://img.shields.io/badge/experience-responsive-64e2d2?style=flat&labelColor=101719" />
  <img alt="Live data" src="https://img.shields.io/badge/data-live%20places%20%2B%20weather-64e2d2?style=flat&labelColor=101719" />
  <img alt="OpenStreetMap map display" src="https://img.shields.io/badge/map-OpenStreetMap-64e2d2?style=flat&labelColor=101719" />
  <img alt="Google Maps navigation" src="https://img.shields.io/badge/navigation-Google%20Maps-64e2d2?style=flat&labelColor=101719" />
</p>

<p align="center"><em>Enter a destination—even a single city name—choose your travel dates, then get a day-by-day plan built around an OpenStreetMap view, Google Maps place details and navigation, and a local forecast.</em></p>

---

## The idea

Nexo gives trip planning a single starting point: **where you want to go**. Add an arrival date, trip length, and optional interests—such as museums, food, neighborhoods, or a slower pace—and Nexo assembles a guide around that trip.

The interface is designed to be explored: compare the weather for each day, scan an itinerary as a table, open venue details, and follow map or local guide links when you want to go deeper.

## What’s inside

| Area | What you get |
| --- | --- |
| **Trip overview** | Destination, dates, length, local time zone, planning style, and mapped listing count in one glance. |
| **Custom itinerary** | A day-by-day schedule with suggested times, nearby stops, opening-hour-aware picks, map links, and walking routes. |
| **Weather** | Daily and hourly conditions, temperature and feels-like, rain chance and amount, wind and gusts, humidity, UV, sunrise, and sunset. |
| **Places** | Tables of attractions, museums, parks, and restaurants with addresses and available hours, fees, cuisine, accessibility, contacts, and websites. |
| **Trip watch** | Event calendars or date-specific searches, forecast risk cues, and links for weather alerts, transport, and local notices. |
| **Local field guide** | Quick destination-specific searches for local food, neighborhoods, markets, lower-cost activities, day trips, transport, customs, and culture. |
| **Maps & navigation** | An OpenStreetMap destination map with visible contributor attribution, plus Google Maps links for individual listings and suggested walking routes. |
| **Useful links** | Destination maps, restaurant searches, accommodation searches, and transit directions. |

The dark, responsive interface uses a restrained cyan accent and a custom geometric Nexo logo in the header and browser tab.

## Accessibility & screen sizes

The layout adapts from narrow phones to wide desktop screens. Dense tables stay readable on small viewports by scrolling within their labeled table regions instead of widening the whole page. The interface includes a skip link, associated form labels and hints, keyboard-visible focus, live status announcements, semantic table captions and headings, native keyboard-operable disclosure controls, and reduced-motion and forced-color support.

Run the responsive and automated accessibility checks with:

```sh
npx playwright install chromium
npm run test:a11y
```

The Playwright suite runs axe-core WCAG A/AA checks on the landing page and generated guide, checks the narrow-screen layouts, and verifies no page-level horizontal overflow at 320, 375, 768, and 1440 pixels. It fetches live destination data, so it needs an internet connection.

## Start planning

1. Enter a destination, such as **Munich**, **Copenhagen**, or **Kyoto**.
2. Choose an arrival date and trip length.
3. Add interests if you want the itinerary to lean toward a particular style.
4. Select **Build my guide** and explore the tables, hourly weather, venue records, and local guide links.

Try one of the included destination examples for a quick start. Forecast dates are limited to the next **16 calendar days**.

## Run it locally

**You’ll need:** Node.js 20 or newer, npm, an internet connection, and a Google Maps Platform API key with Places API (New) enabled. Google may require billing for API access. Keep the key on the server; never put it in frontend code.

```sh
npm install
cp .env.example .env
npm run dev
```

Open the address printed by Vite, usually [http://localhost:5173](http://localhost:5173). The development command starts both the web interface and its API server. Vite forwards `/api` requests to the local Node service.

Create a key in the [Google Maps Platform Console](https://console.cloud.google.com/google/maps-apis), enable **Places API (New)**, and restrict the key to the Places API. Put the key in `.env` as the value of `GOOGLE_MAPS_API_KEY`. The local server loads it from `.env`; the file is ignored by Git and the key is never sent to the browser.

## Production build

```sh
npm run build
npm run preview
```

The compiled frontend is written to `dist/`. For deployment, run `server.js` as a Node service and route `/api` requests to that service. The included Vite proxy is intended for local development.

## Accessibility and responsive checks

Run the browser checks with:

```sh
npm run test:a11y
```

The Playwright suite checks keyboard skip navigation, labeled planner fields, WCAG 2.0/2.1/2.2 A and AA rules with axe, and horizontal overflow at 320 px, 375 px, 768 px, and 1440 px. It checks both the landing screen and a generated trip guide.

## How the data works

- **Google Maps Places API** resolves destinations and provides venue locations, opening hours, contact details, and Google Maps navigation links.
- **OpenStreetMap** supplies the embedded destination map. Its attribution links to the OpenStreetMap copyright page; the embedded map is loaded from openstreetmap.org.
- **Open-Meteo** provides the daily and hourly forecast for the destination coordinates.
- **City calendars and live search links** help you check events, local experiences, and travel notices for your dates.

Nexo doesn’t book travel, reserve tables, or confirm event tickets. Event listings and transport notices open live sources because they can change quickly. Weather cues are planning signals, not official severe-weather alerts. Google Maps place details may be incomplete or out of date, so confirm opening times, prices, and availability with the provider before you go. OpenStreetMap tiles are served under the OpenStreetMap Foundation tile usage policy; for high-traffic production deployment, choose a suitable hosted tile provider.

## Project map

```text
nexo-prototype/
├── index.html             # App shell, metadata, and logo reference
├── package.json           # Project scripts and dependencies
├── public/
│   └── nexo-mark.svg      # Custom logo and browser tab icon
├── server.js              # Destination, venue, and forecast API
├── vite.config.js         # Local API proxy
├── playwright.config.js   # Isolated browser and API setup for accessibility checks
├── src/
│   ├── main.js            # Form flow, guide generation, itinerary, and tables
│   └── styles.css         # Responsive visual system
└── tests/
    └── accessibility.spec.js # WCAG and responsive-layout checks
```

---

<p align="center"><strong>Nexo</strong> · <em>Find your way into a place.</em></p>
