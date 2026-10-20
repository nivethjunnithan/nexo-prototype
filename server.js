import express from 'express';
import 'dotenv/config';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const GOOGLE_PLACES = 'https://places.googleapis.com/v1/places:searchText';
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
  const response = await fetch(url, { signal: AbortSignal.timeout(18000), ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || `Upstream service returned ${response.status}`);
  return body;
}
const placeFieldMask = 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.nationalPhoneNumber,places.websiteUri,places.regularOpeningHours,places.priceLevel,places.accessibilityOptions,places.googleMapsUri,places.addressComponents';
async function googlePlaceSearch(textQuery, location, radius = 25000) {
  const body = { textQuery, pageSize: 20 };
  if (location && Number.isFinite(location.lat) && Number.isFinite(location.lon) && (location.lat !== 0 || location.lon !== 0)) {
    body.locationBias = { circle: { center: { latitude: location.lat, longitude: location.lon }, radius } };
  }
  return getJson(GOOGLE_PLACES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY, 'X-Goog-FieldMask': placeFieldMask },
    body: JSON.stringify(body)
  });
}
function normalizeGooglePlace(item, type) {
  const types = item.types || [];
  const openingHours = item.regularOpeningHours?.weekdayDescriptions?.join('; ') || null;
  return {
    name: item.displayName?.text || '',
    type,
    category: item.primaryType || types[0] || '',
    googlePlaceId: item.id || null,
    lat: Number(item.location?.latitude), lon: Number(item.location?.longitude),
    address: item.formattedAddress || '',
    openingHours,
    website: item.websiteUri || null,
    phone: item.nationalPhoneNumber || null,
    cuisine: types.filter((value) => ['restaurant', 'cafe', 'bakery', 'bar', 'meal_takeaway'].includes(value)).join('; ') || null,
    fee: null,
    wheelchair: item.accessibilityOptions?.wheelchairAccessibleEntrance === true ? 'Wheelchair-accessible entrance' : null,
    googleMapsUri: item.googleMapsUri || null,
    googleTypes: types
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

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
  if (!process.env.GOOGLE_MAPS_API_KEY) return res.status(503).json({ error: 'Add a Google Maps Platform API key with Places API enabled to the GOOGLE_MAPS_API_KEY environment variable, then restart Nexo.' });
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 16) return res.status(400).json({ error: 'Trip length must be between 1 and 16 days.' });
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return res.status(400).json({ error: 'Choose a valid arrival date.' });

  try {
    const cityResult = await googlePlaceSearch(destination);
    const city = cityResult.places?.[0];
    if (!city) return res.status(404).json({ error: `I could not find “${destination}”. Try a nearby city, region, or country name.` });
    const lat = Number(city.location?.latitude), lon = Number(city.location?.longitude);
    const destinationName = city.displayName?.text || destination;
    const searchLocal = async (query, type) => {
      const found = await googlePlaceSearch(`${query} in ${destinationName}`, { lat, lon });
      return (found.places || []).map((place) => normalizeGooglePlace(place, type)).filter((place) => place.name && Number.isFinite(place.lat) && Number.isFinite(place.lon));
    };
    const [attractions, museums, parks, food] = await Promise.all([
      searchLocal('tourist attractions', 'Attraction'),
      searchLocal('museums and art galleries', 'Museum & culture'),
      searchLocal('parks and gardens', 'Park & gardens'),
      searchLocal('restaurants and cafes', 'Restaurant')
    ]);
    const unique = new Map();
    const placeTokens = (name) => name.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((word) => word.length > 4 && !['museum', 'castle', 'palace', 'house', 'garden', 'gallery'].includes(word));
    for (const place of [...attractions, ...museums, ...parks, ...food]) {
      const key = place.name.toLocaleLowerCase();
      const tokens = placeTokens(place.name);
      const duplicateKey = [...unique.entries()].find(([, existing]) => {
        if (place.type === 'Restaurant' !== (existing.type === 'Restaurant')) return false;
        const sharedName = tokens.some((token) => placeTokens(existing.name).includes(token));
        const distanceKm = 111 * Math.hypot(place.lat - existing.lat, (place.lon - existing.lon) * Math.cos(lat * Math.PI / 180));
        return sharedName && distanceKm < 0.05;
      })?.[0];
      const existingKey = unique.has(key) ? key : duplicateKey;
      if (!existingKey) unique.set(key, place);
      else if (!unique.get(existingKey).openingHours && place.openingHours) unique.set(existingKey, place);
    }
    const allPlaces = [...unique.values()];
    const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.search = new URLSearchParams({ latitude: String(lat), longitude: String(lon), daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset', hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,uv_index', forecast_days: '16', timezone: 'auto' });
    const weather = await getJson(weatherUrl).catch(() => null);
    const lowered = `${intent} ${interests}`.toLowerCase();
    const style = /museum|art|history|culture|architecture/.test(lowered) ? 'culture' : /nature|outdoor|garden|park|hike/.test(lowered) ? 'outdoors' : /food|eat|restaurant|cafe|culinary/.test(lowered) ? 'food' : /child|children|kid|family/.test(lowered) ? 'family' : /relax|slow|quiet|easy/.test(lowered) ? 'relaxed' : 'discovery';
    res.json({
      destination: destinationName, displayName: city.formattedAddress || destinationName, lat, lon,
      destinationType: city.primaryType || 'place', address: city.formattedAddress || destinationName,
      countryCode: city.addressComponents?.find((component) => component.types?.includes('country'))?.shortText?.toLowerCase() || null,
      attractions: allPlaces.filter((place) => place.type !== 'Restaurant'),
      food: allPlaces.filter((place) => place.type === 'Restaurant'),
      style, interests, startDate: startDate || null, durationDays,
      weather: weather?.daily || null, hourly: weather?.hourly || null, weatherTimezone: weather?.timezone || null,
      sources: {
        map: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`,
        lodging: `https://www.google.com/travel/search?q=${encodeURIComponent(`hotels in ${destination}`)}`,
        food: `https://www.google.com/maps/search/${encodeURIComponent(`restaurants in ${destination}`)}`,
        events: `https://www.google.com/search?q=${encodeURIComponent(`events in ${destination}${startDate ? ` between ${startDate} and ${endDate}` : ''}`)}`,
        issues: `https://www.google.com/search?q=${encodeURIComponent(`travel disruptions advisories ${destination}`)}`,
        transit: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=transit`,
        weatherAlerts: city.address?.country_code === 'de' ? 'https://www.dwd.de/EN/weather/warnings/warnings_node.html' : `https://www.google.com/search?q=${encodeURIComponent(`weather warnings ${destination}`)}`,
        cityEvents: (city.address?.country_code === 'de' && /munich|münchen/i.test(destination)) ? 'https://www.muenchen.de/en/events' : null,
        copyright: 'https://developers.google.com/maps/documentation/places/web-service/policies'
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Plan request failed:', error.message);
    res.status(502).json({ error: `Google Maps place search is unavailable: ${error.message}` });
  }
});

app.listen(PORT, () => console.log(`Nexo API ready on http://localhost:${PORT}`));
