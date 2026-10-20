import express from 'express';
import 'dotenv/config';
import { resolve } from 'node:path';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
let nominatimQueue = Promise.resolve();
let lastNominatimRequest = 0;

app.use((req, res, next) => {
  const origin = req.get('origin');
  const allowedOrigins = new Set([
    'capacitor://localhost', 'http://localhost', 'https://localhost', 'ionic://localhost',
    ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)
  ]);
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(origin && !allowedOrigins.has(origin) ? 403 : 204);
  next();
});
app.use(express.json({ limit: '16kb' }));

function extractDestination(intent) {
  const cleaned = intent.trim();
  const patterns = [
    /\b(?:go|travel|fly|drive|head|trip|visit|vacation|holiday)\s+to\s+(.+?)(?=\s+(?:this|next)\s+(?:weekend|week)|\s+for\s+\d+|\s+under\s+€|\s+and\s+(?:plan|find|show|make)|$)/iu,
    /\b(?:in|around|near|at)\s+([\p{L}\s,.'-]+?)(?=\s+(?:this|next)\s+(?:weekend|week)|\s+for\s+\d+|\s+under\s+€|\s+and\s+(?:plan|find|show|make)|$)/iu,
    /^([\p{L}\s,.'-]+?)(?:\s+(?:this|next)\s+weekend)?$/iu
  ];
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      const place = match[1].replace(/\b(this|next|weekend|week|plan|something|accordingly|please|i want|i would like|to go|a trip|a weekend)\b/giu, '').trim().replace(/[,.]+$/, '');
      if (place && place.length < 90) return place;
    }
  }
  return null;
}

async function getJson(url, options = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000), ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || body.error || `Upstream service returned ${response.status}`);
  return body;
}

function nominatimJson(url) {
  const request = nominatimQueue.then(async () => {
    const delay = Math.max(0, 1100 - (Date.now() - lastNominatimRequest));
    if (delay) await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    lastNominatimRequest = Date.now();
    return getJson(url, { headers: { 'User-Agent': 'NexoTripPlanner/1.0 (travel itinerary application)' } });
  });
  nominatimQueue = request.catch(() => {});
  return request;
}

async function geocode(query) {
  const url = new URL(NOMINATIM);
  url.search = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: '1' });
  const results = await nominatimJson(url);
  return results[0] || null;
}

function normalizeNominatimPlace(item, type) {
  if (!item.name) return null;
  const isFood = type === 'Restaurant';
  return {
    name: item.name,
    type,
    category: item.type || item.category || 'place',
    osmType: item.osm_type,
    osmId: item.osm_id,
    lat: Number(item.lat), lon: Number(item.lon),
    address: item.display_name || null,
    openingHours: null,
    website: null,
    phone: null,
    cuisine: isFood ? item.type : null,
    fee: null,
    wheelchair: null,
    osmUrl: `https://www.openstreetmap.org/${item.osm_type}/${item.osm_id}`
  };
}

async function getNearbyPlaces(destinationName) {
  const unique = new Map();
  const categories = [['attraction', 'Attraction'], ['museums', 'Museum & culture'], ['parks', 'Park & gardens'], ['restaurants', 'Restaurant']];
  for (const [query, type] of categories) {
    const url = new URL(NOMINATIM);
    url.search = new URLSearchParams({ q: `${query} in ${destinationName}`, format: 'jsonv2', addressdetails: '1', limit: '16' });
    const results = await nominatimJson(url);
    for (const item of results) {
      const place = normalizeNominatimPlace(item, type);
      if (place && Number.isFinite(place.lat) && Number.isFinite(place.lon)) unique.set(`${place.osmType}/${place.osmId}`, place);
    }
  }
  return [...unique.values()];
}

app.get('/api/health', (_req, res) => res.json({ ok: true, maps: 'OpenStreetMap' }));

app.post('/api/plan', async (req, res) => {
  const intent = typeof req.body?.intent === 'string' ? req.body.intent.trim() : '';
  const destinationInput = typeof req.body?.destination === 'string' ? req.body.destination.trim() : '';
  const destination = destinationInput || extractDestination(intent);
  const startDate = typeof req.body?.startDate === 'string' ? req.body.startDate : '';
  const durationDays = Number(req.body?.durationDays || 2);
  const interests = typeof req.body?.interests === 'string' ? req.body.interests.trim().slice(0, 300) : '';
  const endDate = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? (() => { const date = new Date(`${startDate}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + Math.max(0, durationDays - 1)); return date.toISOString().slice(0, 10); })() : '';
  if ((!destination && !intent) || intent.length > 500 || destinationInput.length > 120) return res.status(400).json({ error: 'Enter a destination and optional travel preferences.' });
  if (!destination) return res.status(422).json({ error: 'I could not identify a place. Try entering just a city name, such as “Copenhagen”.' });
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 16) return res.status(400).json({ error: 'Trip length must be between 1 and 16 days.' });
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return res.status(400).json({ error: 'Choose a valid arrival date.' });

  try {
    const city = await geocode(destination);
    if (!city) return res.status(404).json({ error: `I could not find “${destination}”. Try a nearby city, region, or country name.` });
    const lat = Number(city.lat), lon = Number(city.lon);
    const destinationName = city.name || destination;
    const placesPromise = getNearbyPlaces(destinationName).catch((error) => {
      console.error('OpenStreetMap place lookup failed:', error.message);
      return [];
    });
    const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.search = new URLSearchParams({ latitude: String(lat), longitude: String(lon), daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset', hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,uv_index', forecast_days: '16', timezone: 'auto' });
    const [allPlaces, weather] = await Promise.all([placesPromise, getJson(weatherUrl).catch(() => null)]);
    const lowered = `${intent} ${interests}`.toLowerCase();
    const style = /museum|art|history|culture|architecture/.test(lowered) ? 'culture' : /nature|outdoor|garden|park|hike/.test(lowered) ? 'outdoors' : /food|eat|restaurant|cafe|culinary/.test(lowered) ? 'food' : /child|children|kid|family/.test(lowered) ? 'family' : /relax|slow|quiet|easy/.test(lowered) ? 'relaxed' : 'discovery';
    const query = encodeURIComponent(destinationName);
    const search = (text) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(text)}`;
    const countryCode = city.address?.country_code?.toLowerCase() || null;
    res.json({
      destination: destinationName, displayName: city.display_name || destinationName, lat, lon,
      destinationType: city.type || city.class || 'place', address: city.display_name || destinationName, countryCode,
      attractions: allPlaces.filter((place) => place.type !== 'Restaurant'),
      food: allPlaces.filter((place) => place.type === 'Restaurant'),
      style, interests, startDate: startDate || null, durationDays,
      weather: weather?.daily || null, hourly: weather?.hourly || null, weatherTimezone: weather?.timezone || null,
      sources: {
        map: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`,
        lodging: search(`hotels in ${destinationName}`),
        food: search(`restaurants in ${destinationName}`),
        events: `https://www.google.com/search?q=${encodeURIComponent(`events in ${destinationName}${startDate ? ` between ${startDate} and ${endDate}` : ''}`)}`,
        issues: `https://www.google.com/search?q=${encodeURIComponent(`travel disruptions advisories ${destinationName}`)}`,
        transit: `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${lat}%2C${lon}%3B${lat}%2C${lon}`,
        weatherAlerts: countryCode === 'de' ? 'https://www.dwd.de/EN/weather/warnings/warnings_node.html' : `https://www.google.com/search?q=${encodeURIComponent(`weather warnings ${destinationName}`)}`,
        cityEvents: (countryCode === 'de' && /munich|münchen/i.test(destinationName)) ? 'https://www.muenchen.de/en/events' : null,
        streetView: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat}%2C${lon}`,
        copyright: 'https://www.openstreetmap.org/copyright'
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Plan request failed:', error.message);
    res.status(502).json({ error: `OpenStreetMap destination lookup is unavailable: ${error.message}` });
  }
});

const distDirectory = resolve('dist');
app.use(express.static(distDirectory, { index: false }));
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(resolve(distDirectory, 'index.html'), (error) => { if (error) next(error); });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Nexo web + API ready on http://localhost:${PORT}`));
