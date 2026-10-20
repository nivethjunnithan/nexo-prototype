<p align="center">
  <img src="public/nexo-mark.svg" alt="Nexo logo: a glowing cyan geometric N" width="88" height="88" />
</p>

<h1 align="center">Nexo</h1>

<p align="center"><strong>Your place. Your plan.</strong><br />A destination-first trip planner that turns a city, a date, and a few interests into a practical guide for the days ahead.</p>

<p align="center">
  <img alt="Responsive web app" src="https://img.shields.io/badge/experience-responsive-64e2d2?style=flat&labelColor=101719" />
  <img alt="Live data" src="https://img.shields.io/badge/data-live%20places%20%2B%20weather-64e2d2?style=flat&labelColor=101719" />
  <img alt="OpenStreetMap map display" src="https://img.shields.io/badge/map-OpenStreetMap-64e2d2?style=flat&labelColor=101719" />
  <img alt="Street-level imagery" src="https://img.shields.io/badge/street%20view-Google%20Maps%20URL-64e2d2?style=flat&labelColor=101719" />
  <img alt="Installable PWA and mobile apps" src="https://img.shields.io/badge/platforms-web%20%7C%20Android%20%7C%20iOS-64e2d2?style=flat&labelColor=101719" />
</p>

<p align="center"><em>Enter a destination—even a single city name—choose your travel dates, then get a day-by-day plan built around OpenStreetMap place listings and maps, optional Street View links, and a local forecast.</em></p>

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
| **Maps & navigation** | OpenStreetMap destination and place links with visible attribution, walking directions, and Street View links where imagery is available. |
| **Useful links** | Destination maps, restaurant searches, accommodation searches, and transit directions. |

The dark, responsive interface uses a restrained cyan accent and a custom geometric Nexo logo. Nexo ships as a responsive website, an installable Progressive Web App (PWA), and Capacitor-based Android and iOS app projects from the same web experience.

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

**You’ll need:** Node.js 22 or newer, npm, and an internet connection. Destination and place data use public OpenStreetMap services; no Google API key is required.

```sh
npm install
cp .env.example .env
npm run dev
```

Open the address printed by Vite, usually [http://localhost:5173](http://localhost:5173). The development command starts both the web interface and its API server. Vite forwards `/api` requests to the local Node service.

## Website deployment

```sh
npm install
cp .env.example .env
npm run build
npm start
```

The Node service serves the compiled website and its `/api` trip-planning endpoint from one origin. Set `PORT` in the hosting environment. This same-origin deployment is the simplest setup. If you host the website and API separately, build the website with `VITE_API_BASE_URL=https://api.example.com` and set `CORS_ALLOWED_ORIGINS=https://www.example.com` on the API server. Serve the website over HTTPS so browsers can install it as a PWA.

## Publish the website on GitHub Pages

GitHub Pages publishes the static website. The trip planner still needs the Node API, so deploy this repository as a Node web service on a host such as Render first:

1. Create a Node web service from this GitHub repository. Use `npm ci && npm run build` for the build command and `npm start` for the start command. Node.js 22 or newer is required.
2. In the API host's environment settings, set `CORS_ALLOWED_ORIGINS` to `https://nivethjunnithan.github.io`. No Google Maps key is needed.
3. In this GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and add `VITE_API_BASE_URL` with the public HTTPS URL of the API service.
4. Open **Settings → Pages** and set the publishing source to **GitHub Actions**.
5. Push to `main`, or manually run **Deploy Nexo to GitHub Pages** from the **Actions** tab.

The included workflow builds and deploys the site at `https://nivethjunnithan.github.io/nexo-prototype/`. GitHub Pages does not run the Node API, so keep the API service running separately. GitHub documents Pages as static hosting and supports custom build-and-deploy workflows through Actions.

## Install the website as an app

Nexo includes a web app manifest, platform icons, and a service worker for caching the app shell. On Android, open the HTTPS website in Chrome and choose **Install app**. On iPhone or iPad, open it in Safari, tap **Share**, then **Add to Home Screen**. Trip planning still needs an internet connection.

## Android and iOS apps

Capacitor wraps the same built web experience in native Android and iOS projects. Native apps call the separately hosted Nexo API over HTTPS; they do not need a Google API key for trip planning. Configure the public API origin before each mobile build:

```sh
VITE_API_BASE_URL=https://api.example.com npm run build:mobile
```

Replace `https://api.example.com` with the HTTPS origin running `server.js`. Then open the native projects in Android Studio or Xcode:

```sh
npm run cap:open:android
npm run cap:open:ios
```

The generated projects live in `android/` and `ios/`. Android builds require Android Studio and an Android SDK. iOS builds require macOS and Xcode. This project has the native shells and icons scaffolded; build and signing still happen in Android Studio and Xcode. Capacitor 8 also requires Node.js 22 or newer; the iOS project needs Xcode 26 or newer, and Android Studio 2025.2.1 or newer. Signing, store listings, screenshots, privacy disclosures, and developer accounts are needed to publish the apps.

After changing web code, rebuild and sync native assets with `VITE_API_BASE_URL=https://api.example.com npm run build:mobile`. The app ID `com.nexo.tripplanner` is provisional; choose an ID you control before store submission.

## Accessibility and responsive checks

Run the browser checks with:

```sh
npm run test:a11y
```

The Playwright suite checks keyboard skip navigation, labeled planner fields, WCAG 2.0/2.1/2.2 A and AA rules with axe, and horizontal overflow at 320 px, 375 px, 768 px, and 1440 px. It checks both the landing screen and a generated trip guide.

## How the data works

- **OpenStreetMap Nominatim** resolves destinations and searches for nearby attractions, museums, parks, and restaurants. The embedded map and place links use OpenStreetMap with visible attribution.
- **Street View** is opened as a Google Maps URL at the destination coordinates. Google documents Maps URLs as usable without an API key; imagery depends on local coverage.
- **Open-Meteo** provides the daily and hourly forecast for the destination coordinates.
- **City calendars and live search links** help you check events, local experiences, and travel notices for your dates.

Nexo doesn’t book travel, reserve tables, or confirm event tickets. Event listings and transport notices open live sources because they can change quickly. Weather cues are planning signals, not official severe-weather alerts. OpenStreetMap details may be incomplete or out of date, so confirm opening times, prices, and availability with the provider before you go. Public Nominatim has a one-request-per-second usage limit, which Nexo observes; for high-traffic production deployment, use an appropriately hosted provider. OpenStreetMap tiles are served under the OpenStreetMap Foundation tile usage policy.

## Project map

```text
nexo-prototype/
├── index.html             # App shell, metadata, and logo reference
├── package.json           # Project scripts and dependencies
├── capacitor.config.json  # Shared Android and iOS app identity
├── public/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-512.png
│   ├── icons/              # Apple touch icon
│   ├── manifest.webmanifest
│   ├── sw.js              # Offline app shell cache
│   └── nexo-mark.svg      # Logo and browser tab icon
├── resources/
│   ├── icon.svg            # Editable native app icon source
│   └── icon.png            # 1024 px native icon source
├── server.js              # Website host and destination, venue, and forecast API
├── vite.config.js          # Development and preview API proxy
├── android/                # Android Studio project
├── ios/                    # Xcode project
├── scripts/
│   └── build-mobile.mjs   # Requires a public HTTPS API URL
├── playwright.config.js    # Isolated browser and API setup for accessibility checks
├── src/
│   ├── main.js            # Form flow, guide generation, itinerary, and tables
│   └── styles.css         # Responsive visual system
└── tests/
    └── accessibility.spec.js # WCAG and responsive-layout checks
```

---

<p align="center"><strong>Nexo</strong> · <em>Find your way into a place.</em></p>
