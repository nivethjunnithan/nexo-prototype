import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const form = document.getElementById('intentForm');
const input = document.getElementById('destination');
const startDateInput = document.getElementById('startDate');
const durationInput = document.getElementById('duration');
const interestsInput = document.getElementById('interests');
const results = document.getElementById('results');
const submitButton = document.getElementById('submitBtn');
const planStatus = document.getElementById('planStatus');
const installButton = document.getElementById('installApp');
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
let latestController;
const today = new Date();
const todayLocal = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const defaultStart = new Date(`${todayLocal}T12:00:00`);
defaultStart.setDate(defaultStart.getDate() + ((6 - defaultStart.getDay() + 7) % 7 || 7));
startDateInput.value = localDateString(defaultStart);
startDateInput.min = todayLocal;
function localDateString(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function updateDateLimit() {
  const latestStart = new Date(`${todayLocal}T12:00:00`);
  latestStart.setDate(latestStart.getDate() + Math.max(0, 16 - Number(durationInput.value || 1)));
  startDateInput.max = localDateString(latestStart);
  if (startDateInput.value > startDateInput.max) startDateInput.value = startDateInput.max;
}
updateDateLimit();
durationInput.addEventListener('input', updateDateLimit);

const styleNames = { discovery: 'City highlights', culture: 'Culture & history', outdoors: 'Parks & outdoors', food: 'Food & local flavor', family: 'Family friendly', relaxed: 'A slower pace' };
const styleNotes = {
  discovery: 'A balanced first visit: signature sights, a green break, and well placed food stops.',
  culture: 'Prioritizes museums, architecture, and historic places, with a park break in the plan.',
  outdoors: 'Puts gardens and outdoor places first, with nearby sights and food around them.',
  food: 'Builds the day around local places to eat, with nearby city highlights between stops.',
  family: 'Balances varied city highlights with parks and meal breaks to keep the days flexible.',
  relaxed: 'Keeps the schedule lighter and gives you more room between places.'
};

function tripDates(start, count) {
  const first = new Date(`${start}T12:00:00`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first); date.setDate(first.getDate() + index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
}
function prettyDate(dateString, weekday = true) {
  if (!dateString) return '';
  return new Intl.DateTimeFormat(undefined, { weekday: weekday ? 'long' : undefined, month: 'short', day: 'numeric' }).format(new Date(`${dateString}T12:00:00`));
}
function weatherDescription(code) {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if ([45, 48].includes(code)) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Forecast';
}
function weatherAt(weather, date) {
  if (!weather?.time) return null;
  const index = weather.time.indexOf(date);
  if (index < 0) return null;
  return {
    high: weather.temperature_2m_max?.[index], low: weather.temperature_2m_min?.[index],
    rain: weather.precipitation_probability_max?.[index], precip: weather.precipitation_sum?.[index], wind: weather.wind_speed_10m_max?.[index], uv: weather.uv_index_max?.[index],
    code: weather.weather_code?.[index], sunrise: weather.sunrise?.[index], sunset: weather.sunset?.[index]
  };
}
function hourlyWeatherCard(date, hourly) {
  if (!hourly?.time) return '';
  const rows = hourly.time.map((stamp, index) => ({ stamp, index })).filter(({ stamp }) => stamp.startsWith(date) && Number(stamp.slice(11, 13)) >= 7 && Number(stamp.slice(11, 13)) <= 22);
  if (!rows.length) return '';
  return `<details class="hourly-card"><summary>Hourly outlook · ${prettyDate(date)}</summary><div class="hourly-scroll" role="region" tabindex="0" aria-label="Scrollable hourly weather forecast table"><table aria-label="Hourly weather forecast"><caption class="sr-only">Hourly weather forecast for ${prettyDate(date)}</caption><thead><tr><th scope="col">Time</th><th scope="col">Temp</th><th scope="col">Feels</th><th scope="col">Rain</th><th scope="col">Wind / gusts</th><th scope="col">Humidity</th><th scope="col">UV</th></tr></thead><tbody>${rows.map(({ stamp, index }) => `<tr><td>${stamp.slice(11, 16)}</td><td>${hourly.temperature_2m?.[index] == null ? '—' : Math.round(hourly.temperature_2m[index])}°</td><td>${hourly.apparent_temperature?.[index] == null ? '—' : Math.round(hourly.apparent_temperature[index])}°</td><td>${hourly.precipitation_probability?.[index] ?? '—'}%</td><td>${hourly.wind_speed_10m?.[index] ?? '—'} / ${hourly.wind_gusts_10m?.[index] ?? '—'} km/h</td><td>${hourly.relative_humidity_2m?.[index] ?? '—'}%</td><td>${hourly.uv_index?.[index] ?? '—'}</td></tr>`).join('')}</tbody></table></div></details>`;
}
function dailyWeatherTable(dates, weather) {
  return `<div class="data-table-wrap" role="region" tabindex="0" aria-label="Scrollable trip information table"><table class="data-table weather-table" aria-label="Daily weather forecast"><caption class="sr-only">Daily forecast for the trip dates</caption><thead><tr><th scope="col">Date</th><th scope="col">Conditions</th><th scope="col">Low / high</th><th scope="col">Rain</th><th scope="col">Wind</th><th scope="col">UV max</th><th scope="col">Sunrise / sunset</th></tr></thead><tbody>${dates.map((date) => {
    const w = weatherAt(weather, date);
    return `<tr><th scope="row"><b>${prettyDate(date)}</b></th><td>${w ? weatherDescription(w.code) : 'Not available'}</td><td>${w ? `${w.low == null ? '—' : Math.round(w.low)}° / ${w.high == null ? '—' : Math.round(w.high)}°C` : '—'}</td><td>${w ? `${w.rain ?? '—'}% · ${w.precip == null ? '—' : Number(w.precip).toFixed(1)} mm` : '—'}</td><td>${w?.wind == null ? '—' : `${Math.round(w.wind)} km/h`}</td><td>${w?.uv ?? '—'}</td><td>${w ? `${w.sunrise?.slice(11, 16) || '—'} / ${w.sunset?.slice(11, 16) || '—'}` : '—'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function mapUrl(place) { return place.osmUrl || `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=18/${place.lat}/${place.lon}`; }
function distance(a, b) { return Math.hypot((a.lat - b.lat) * Math.cos(a.lat * Math.PI / 180), a.lon - b.lon); }
function orderedByProximity(places, start, count) {
  const pool = [...places];
  const chosen = [];
  let anchor = start;
  while (pool.length && chosen.length < count) {
    pool.sort((a, b) => distance(a, anchor) - distance(b, anchor));
    const next = pool.shift();
    chosen.push(next);
    anchor = next;
  }
  return chosen;
}
function selectedPlaces(plan, dates) {
  const style = plan.style || 'discovery';
  const wetWeekend = dates.every((date) => (weatherAt(plan.weather, date)?.rain ?? 0) >= 45);
  const weatherPriority = wetWeekend && style === 'discovery';
  const order = style === 'culture' || weatherPriority ? ['Museum & culture', 'Attraction', 'Park & gardens']
    : style === 'outdoors' ? ['Park & gardens', 'Attraction', 'Museum & culture']
    : style === 'family' ? ['Attraction', 'Park & gardens', 'Museum & culture']
    : ['Attraction', 'Museum & culture', 'Park & gardens'];
  let pool = [...plan.attractions];
  if (style === 'food') pool = [...plan.attractions].sort((a, b) => distance(a, { lat: plan.lat, lon: plan.lon }) - distance(b, { lat: plan.lat, lon: plan.lon }));
  else pool.sort((a, b) => (order.indexOf(a.type) < 0 ? 9 : order.indexOf(a.type)) - (order.indexOf(b.type) < 0 ? 9 : order.indexOf(b.type)) || distance(a, { lat: plan.lat, lon: plan.lon }) - distance(b, { lat: plan.lat, lon: plan.lon }));
  const dayCount = style === 'relaxed' ? 2 : 3;
  const first = orderedByProximity(pool.slice(0, Math.ceil(pool.length / 2)), { lat: plan.lat, lon: plan.lon }, dayCount);
  const used = new Set(first.map((place) => place.name));
  const secondPool = pool.filter((place) => !used.has(place.name));
  const second = orderedByProximity(secondPool, first.at(-1) || { lat: plan.lat, lon: plan.lon }, dayCount);
  second.forEach((place) => used.add(place.name));
  const daily = [first, second];
  for (let day = 2; day < dates.length; day += 1) {
    const remaining = pool.filter((place) => !used.has(place.name));
    const chunk = remaining.slice(0, Math.ceil(remaining.length / (dates.length - day)));
    const chosen = orderedByProximity(chunk, daily.at(-1)?.at(-1) || { lat: plan.lat, lon: plan.lon }, dayCount);
    chosen.forEach((place) => used.add(place.name));
    daily.push(chosen);
  }
  return daily;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function safeWebUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
function venueDetails(place) {
  const rows = [
    ['Address', place.address], ['Opening hours', place.openingHours], ['Admission', place.fee],
    ['Cuisine', place.cuisine], ['Accessibility', place.wheelchair], ['Phone', place.phone]
  ].filter((row) => row[1]);
  const website = safeWebUrl(place.website);
  if (website) rows.push(['Website', `<a href="${escapeHtml(website)}" target="_blank" rel="noreferrer">Open official site ↗</a>`]);
  if (place.osmUrl) rows.push(['Map', `<a href="${escapeHtml(place.osmUrl)}" target="_blank" rel="noreferrer">Open OpenStreetMap place ↗</a>`]);
  if (!rows.length) return '<p class="detail-empty">No additional details are listed for this place yet.</p>';
  return `<dl class="venue-data">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${label === 'Website' || label === 'Map' ? value : escapeHtml(value)}</dd></div>`).join('')}</dl>`;
}
function routeUrl(places) {
  if (!places.length) return '#';
  const point = (place) => `${place.lat},${place.lon}`;
  const route = places.map((place) => point(place).replace(',', '%2C')).join('%3B');
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${route}`;
}
function openStreetMapEmbedUrl(plan) {
  const lat = Number(plan.lat), lon = Number(plan.lon);
  const latSpan = 0.035;
  const lonSpan = 0.055 / Math.max(0.25, Math.cos(lat * Math.PI / 180));
  const bounds = [lon - lonSpan, lat - latSpan, lon + lonSpan, lat + latSpan].join(',');
  const params = new URLSearchParams({ bbox: bounds, layer: 'mapnik', marker: `${lat},${lon}` });
  return `https://www.openstreetmap.org/export/embed.html?${params}`;
}
function likelyOpenAt(place, date, time) {
  const source = place.openingHours;
  if (!source) return null;
  if (/^24\/7$/.test(source.trim())) return true;
  const dayCodes = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const day = dayCodes[new Date(`${date}T12:00:00`).getDay()];
  const monthCodes = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthCodes[Number(date.slice(5, 7)) - 1];
  let foundRule = false;
  let open = false;
  for (const rawRule of source.split(';')) {
    const rule = rawRule.trim();
    const firstToken = rule.split(/\s+/)[0] || '';
    const daySpec = firstToken.split(',').filter((token) => /^(Mo|Tu|We|Th|Fr|Sa|Su)/.test(token));
    const monthSpec = firstToken.split(',').filter((token) => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(token));
    if (daySpec.length && !daySpec.some((token) => {
      const match = token.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
      if (!match) return token === day;
      if (!match[2]) return match[1] === day;
      const start = dayCodes.indexOf(match[1]), end = dayCodes.indexOf(match[2]), current = dayCodes.indexOf(day);
      return start <= end ? current >= start && current <= end : current >= start || current <= end;
    })) continue;
    if (monthSpec.length && !monthSpec.some((token) => {
      const match = token.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))?$/);
      if (!match) return token === month;
      if (!match[2]) return match[1] === month;
      const start = monthCodes.indexOf(match[1]), end = monthCodes.indexOf(match[2]), current = monthCodes.indexOf(month);
      return start <= end ? current >= start && current <= end : current >= start || current <= end;
    })) continue;
    foundRule = true;
    if (/\b(off|closed)\b/i.test(rule)) return false;
    const ranges = [...rule.matchAll(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/g)];
    if (!ranges.length) { open = true; continue; }
    const toMinutes = (v) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
    const current = toMinutes(time);
    if (ranges.some(([, start, end]) => current >= toMinutes(start) && current < toMinutes(end))) open = true;
  }
  return foundRule ? open : null;
}
function mealAt(food, near, used, date, time) {
  const candidates = food.filter((place) => !used.has(place.name) && likelyOpenAt(place, date, time) !== false);
  candidates.sort((a, b) => distance(a, near) - distance(b, near));
  const choice = candidates[0];
  if (choice) used.add(choice.name);
  return choice;
}
function makeDay(day, dayIndex, date, attractionList, plan, foodUsed) {
  const places = [];
  const stops = [];
  const usedAttractions = new Set();
  function chooseActivity(time) {
    const candidate = attractionList.find((place) => !usedAttractions.has(place.name) && likelyOpenAt(place, date, time) !== false);
    if (candidate) usedAttractions.add(candidate.name);
    return candidate;
  }
  const morning = chooseActivity('10:00');
  const second = chooseActivity('14:00');
  const third = chooseActivity('16:30');
  if (morning) { stops.push({ time: '10:00', label: 'Start the day', place: morning }); places.push(morning); }
  const lunch = mealAt(plan.food, morning || { lat: plan.lat, lon: plan.lon }, foodUsed, date, '12:30');
  if (lunch) { stops.push({ time: '12:30', label: 'Lunch nearby', place: lunch }); places.push(lunch); }
  if (second) { stops.push({ time: '14:00', label: 'Afternoon visit', place: second }); places.push(second); }
  if (third) { stops.push({ time: '16:30', label: 'A final stop', place: third }); places.push(third); }
  const dinner = mealAt(plan.food, third || second || { lat: plan.lat, lon: plan.lon }, foodUsed, date, '19:00');
  if (dinner) { stops.push({ time: '19:00', label: 'Dinner idea', place: dinner }); places.push(dinner); }
  const w = weatherAt(plan.weather, date);
  const weatherSummary = w ? `${weatherDescription(w.code)} · ${w.low == null ? '—' : Math.round(w.low)}°–${w.high == null ? '—' : Math.round(w.high)}°C · ${w.rain ?? '—'}% rain` : 'Forecast unavailable';
  const rows = stops.map((stop) => `<tr><td class="table-time">${stop.time}</td><td><div class="table-main"><span class="stop-type">${escapeHtml(stop.place.type)}</span><b>${escapeHtml(stop.place.name)}</b><small>${escapeHtml(stop.label)}</small></div></td><td>${escapeHtml(stop.place.address || 'Address not listed')}${stop.place.openingHours ? `<small class="table-sub">Hours: ${escapeHtml(stop.place.openingHours)}</small>` : '<small class="table-sub">Hours not listed</small>'}</td><td class="table-actions"><a href="${mapUrl(stop.place)}" target="_blank" rel="noreferrer">Map ↗</a><details class="table-details"><summary>Details</summary>${venueDetails(stop.place)}</details></td></tr>`).join('');
  return `<section class="day-plan"><header class="day-plan-head"><div><span class="day-kicker">DAY ${String(dayIndex + 1).padStart(2, '0')}</span><h3>${day} · ${prettyDate(date, false)}</h3><p>${stops.length} suggested stops, ordered into a flexible day</p></div><span class="day-weather">${weatherSummary}</span></header>${stops.length ? `<div class="data-table-wrap itinerary-table-wrap" role="region" tabindex="0" aria-label="Scrollable itinerary table for ${day}, ${prettyDate(date, false)}"><table class="data-table itinerary-table" aria-label="Itinerary for ${day}, ${prettyDate(date, false)}"><caption class="sr-only">${day}, ${prettyDate(date, false)} itinerary</caption><thead><tr><th scope="col">Time</th><th scope="col">Stop</th><th scope="col">Location & hours</th><th scope="col">Explore</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="detail-empty">No suitable mapped places were found for this day. Open the destination search to explore more.</p>'}${places.length > 1 ? `<a class="route-link" href="${routeUrl(places)}" target="_blank" rel="noreferrer">↗ Open suggested walking route (${places.length} stops)</a>` : ''}</section>`;
}
function placeDirectoryTable(places) {
  if (!places.length) return '<p class="detail-empty">No mapped places were returned for this category.</p>';
  return `<div class="data-table-wrap" role="region" tabindex="0" aria-label="Scrollable trip information table"><table class="data-table place-table" aria-label="Mapped destination places"><caption class="sr-only">Places in this category</caption><thead><tr><th scope="col">Place</th><th scope="col">Category</th><th scope="col">Address</th><th scope="col">Hours</th><th scope="col">Cost / access</th><th scope="col">Links & details</th></tr></thead><tbody>${places.map((place) => `<tr><td><b>${escapeHtml(place.name)}</b>${place.cuisine ? `<small class="table-sub">${escapeHtml(place.cuisine.replaceAll(';', ' · '))}</small>` : ''}</td><td>${escapeHtml(place.type)}</td><td>${escapeHtml(place.address || 'Address not listed')}</td><td>${escapeHtml(place.openingHours || 'Not listed')}</td><td>${escapeHtml([place.fee ? `Fee: ${place.fee}` : '', place.wheelchair ? `Access: ${place.wheelchair}` : ''].filter(Boolean).join(' · ') || 'Not listed')}</td><td class="table-actions"><a href="${mapUrl(place)}" target="_blank" rel="noreferrer">Map ↗</a><details class="table-details"><summary>More</summary>${venueDetails(place)}</details></td></tr>`).join('')}</tbody></table></div>`;
}
function renderPlan(plan, intent) {
  const dates = tripDates(plan.startDate || startDateInput.value, Number(plan.durationDays || durationInput.value || 2));
  const dailyPlaces = selectedPlaces(plan, dates);
  const foodUsed = new Set();
  const days = dates.map((date, index) => makeDay(new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(`${date}T12:00:00`)), index, date, dailyPlaces[index] || [], plan, foodUsed));
  const allPlaces = [...plan.attractions, ...plan.food];
  const styleName = styleNames[plan.style] || styleNames.discovery;
  const forecastTip = dates.some((date) => (weatherAt(plan.weather, date)?.rain ?? 0) >= 55) ? ' Rain is possible on some days, so indoor options are mixed into the schedule.' : '';
  const mapSearch = plan.sources.map;
  const lodgingQuery = plan.sources.lodging;
  const dailyWeather = dailyWeatherTable(dates, plan.weather);
  const hourlyCards = dates.map((date) => hourlyWeatherCard(date, plan.hourly)).join('');
  const issues = dates.map((date) => ({ date, weather: weatherAt(plan.weather, date) })).filter(({ weather }) => weather && ((weather.rain ?? 0) >= 60 || (weather.wind ?? 0) >= 45 || (weather.low ?? 20) <= 2 || (weather.high ?? 0) >= 34));
  const issueText = issues.length ? issues.map(({ date, weather }) => `${prettyDate(date, false)}: ${weather.rain >= 60 ? 'high rain chance' : ''}${weather.wind >= 45 ? ' strong wind' : ''}${weather.low <= 2 ? ' near-freezing low' : ''}${weather.high >= 34 ? ' high heat' : ''}`.trim()).join(' · ') : 'No major weather signal in the forecast window. Check official city and transport notices again before departure.';
  const eventUrl = plan.sources.cityEvents || plan.sources.events;
  const dateLabel = `${prettyDate(dates[0], false)} – ${prettyDate(dates.at(-1), false)}`;
  const watchTable = `<div class="data-table-wrap" role="region" tabindex="0" aria-label="Scrollable trip information table"><table class="data-table watch-table" aria-label="Events, conditions, and travel checks"><caption class="sr-only">Current checks for this trip</caption><thead><tr><th scope="col">Topic</th><th scope="col">What to know</th><th scope="col">Live source</th></tr></thead><tbody><tr><th scope="row">Events</th><td>Browse events for ${escapeHtml(dateLabel)} and confirm dates, tickets, and venue access.</td><td><a href="${eventUrl}" target="_blank" rel="noreferrer">${plan.sources.cityEvents ? 'Munich official calendar ↗' : 'Search events ↗'}</a></td></tr><tr><th scope="row">Weather risks</th><td>${escapeHtml(issueText)} Planning cue only; review official alerts before departure.</td><td><a href="${plan.sources.weatherAlerts}" target="_blank" rel="noreferrer">${plan.countryCode === 'de' ? 'DWD warnings ↗' : 'Regional alerts ↗'}</a></td></tr><tr><th scope="row">Transport & notices</th><td>Check planned works, strikes, service changes, road closures, and airport updates close to departure.</td><td><a href="${plan.sources.issues}" target="_blank" rel="noreferrer">Travel notices ↗</a> · <a href="${plan.sources.transit}" target="_blank" rel="noreferrer">Walking directions ↗</a></td></tr><tr><th scope="row">Venue checks</th><td>Opening hours and fees appear only when listed in OpenStreetMap. Confirm special closures directly.</td><td><a href="${mapSearch}" target="_blank" rel="noreferrer">Destination map ↗</a></td></tr></tbody></table></div>`;
  const guideTopics = [['Local food & specialties', `local dishes and food specialties in ${plan.destination}`], ['Neighborhoods', `best neighborhoods to explore in ${plan.destination}`], ['Markets & low-cost finds', `markets and free things to do in ${plan.destination}`], ['Day trips', `best day trips from ${plan.destination}`], ['Getting around', `public transport tickets and how to get around ${plan.destination}`], ['Local customs & visitor tips', `local customs visitor tips and etiquette in ${plan.destination}`], ['Nightlife & culture', `music nightlife and cultural experiences in ${plan.destination}`]];
  const guideTable = `<div class="data-table-wrap" role="region" tabindex="0" aria-label="Scrollable trip information table"><table class="data-table guide-table" aria-label="Local destination guide"><caption class="sr-only">Destination-specific topics and search links</caption><thead><tr><th scope="col">Explore</th><th scope="col">What you can discover</th><th scope="col">Open guide</th></tr></thead><tbody>${guideTopics.map(([topic, query]) => `<tr><th>${escapeHtml(topic)}</th><td>Find current, destination-specific ideas and practical recommendations.</td><td><a href="https://www.google.com/search?q=${encodeURIComponent(query)}" target="_blank" rel="noreferrer">Explore ${escapeHtml(plan.destination)} ↗</a></td></tr>`).join('')}</tbody></table></div>`;
  const overviewTable = `<div class="data-table-wrap" role="region" tabindex="0" aria-label="Scrollable trip information table"><table class="data-table overview-table" aria-label="Trip overview"><caption class="sr-only">Trip overview and destination details</caption><tbody><tr><th scope="row">Visit window</th><td>${escapeHtml(dateLabel)}</td><th scope="row">Length</th><td>${plan.durationDays} days</td></tr><tr><th scope="row">Destination</th><td>${escapeHtml(plan.displayName)}</td><th scope="row">Local time zone</th><td>${escapeHtml(plan.weatherTimezone || 'Not available')}</td></tr><tr><th scope="row">Trip style</th><td>${escapeHtml(styleName)}</td><th scope="row">Places mapped</th><td>${allPlaces.length} (${plan.attractions.length} sights · ${plan.food.length} food)</td></tr><tr><th scope="row">Interests</th><td colspan="3">${escapeHtml(plan.interests || 'Balanced first visit')}</td></tr></tbody></table></div>`;
  results.innerHTML = `<div class="result-head"><div><div class="section-tag">PERSONALIZED CITY PLAN <span style="color:var(--cyan)">/</span> ${escapeHtml(plan.destination.toUpperCase())}</div><h2>${escapeHtml(plan.durationDays)} days in ${escapeHtml(plan.destination)}.</h2><p>${escapeHtml(dateLabel)} · ${escapeHtml(plan.address || plan.displayName)} · ${escapeHtml(styleName)}</p></div><div class="result-actions"><a class="result-link" href="${mapSearch}" target="_blank" rel="noreferrer">⌖ Destination map ↗</a><a class="result-link" href="${lodgingQuery}" target="_blank" rel="noreferrer">▤ Search stays ↗</a><a class="result-link" href="${mapSearch}" target="_blank" rel="noreferrer">⌕ Browse this area ↗</a></div></div><section class="plan-intro"><span class="intro-icon">✳</span><div><b>${escapeHtml(styleName)} itinerary for ${escapeHtml(plan.destination)}</b><p>${escapeHtml(styleNotes[plan.style] || styleNotes.discovery)}${escapeHtml(forecastTip)} ${plan.interests ? `Tailored around: ${escapeHtml(plan.interests)}.` : 'A balanced first visit, tailored to your dates.'} Weather and venue data can change; use the linked source details to confirm before setting out.</p></div></section><section class="overview-section"><div class="section-heading"><div><span class="section-tag">TRIP AT A GLANCE</span><h3>Your plan, clearly laid out</h3></div></div>${overviewTable}</section><section class="map-section"><div class="section-heading"><div><span class="section-tag">OPENSTREETMAP</span><h3>Explore the destination</h3><p>Browse the destination and venue listings with OpenStreetMap. Street-level imagery opens separately where Google Street View coverage is available.</p></div><a class="result-link" href="https://www.openstreetmap.org/?mlat=${Number(plan.lat)}&mlon=${Number(plan.lon)}#map=14/${Number(plan.lat)}/${Number(plan.lon)}" target="_blank" rel="noreferrer">Open full map ↗</a></div><div class="map-frame"><iframe title="OpenStreetMap centered on ${escapeHtml(plan.destination)}" src="${openStreetMapEmbedUrl(plan)}" loading="lazy" allowfullscreen></iframe></div><p class="map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · Place data © OpenStreetMap contributors.</p></section><section class="weather-section"><div class="section-heading"><div><span class="section-tag">LOCAL FORECAST</span><h3>Weather for each day</h3><p>Daily highs and lows, precipitation, wind, UV, and daylight times.</p></div><span class="weather-attribution">${escapeHtml(plan.weatherTimezone || 'Local time')} · Open-Meteo</span></div>${dailyWeather}<div class="hourly-list">${hourlyCards}</div></section><section class="itinerary-section"><div class="section-heading"><div><span class="section-tag">A FLEXIBLE PLAN</span><h3>Customized itinerary</h3><p>Day-by-day stops arranged by nearby locations and your trip length. Times are suggestions; verify venue hours.</p></div><span class="style-badge">✳ ${escapeHtml(styleName)}</span></div><div class="day-grid">${days.join('')}</div></section><section class="issues-section"><div class="section-heading"><div><span class="section-tag">TRIP WATCH</span><h3>Events, conditions & practical checks</h3><p>Signals to check for your destination and dates. Official live status can change quickly.</p></div></div>${watchTable}</section><section class="directory-section"><div class="section-heading"><div><span class="section-tag">LIVE PLACE DETAILS</span><h3>Places around ${escapeHtml(plan.destination)}</h3><p>Address, opening times, access, and official links appear where the map listing provides them.</p></div><span class="style-badge">${allPlaces.length} listings found</span></div><div class="directory-group"><h4>Things to see <span>${plan.attractions.length}</span></h4>${placeDirectoryTable(plan.attractions)}</div><div class="directory-group"><h4>Places to eat <span>${plan.food.length}</span></h4>${placeDirectoryTable(plan.food)}</div></section><section class="guide-section"><div class="section-heading"><div><span class="section-tag">LOCAL FIELD GUIDE</span><h3>More to discover in ${escapeHtml(plan.destination)}</h3><p>Explore neighborhoods, local flavors, day trips, transport, and culture through current destination-specific guides.</p></div></div>${guideTable}</section><section class="destination-panel"><div class="section-heading"><div><span class="section-tag">DESTINATION DETAILS</span><h3>${escapeHtml(plan.destination)}</h3><p>${escapeHtml(plan.displayName)}</p></div><a class="result-link" href="${mapSearch}" target="_blank" rel="noreferrer">Open map pin ↗</a></div><div class="destination-facts"><div><small>Coordinates</small><b>${Number(plan.lat).toFixed(4)}, ${Number(plan.lon).toFixed(4)}</b></div><div><small>Place type</small><b>${escapeHtml(plan.destinationType || 'Mapped place')}</b></div><div><small>Dates</small><b>${escapeHtml(dateLabel)}</b></div><div><small>Planning style</small><b>${escapeHtml(styleName)}</b></div></div><div class="destination-actions"><a href="${plan.sources.food}" target="_blank" rel="noreferrer">Find restaurants on maps ↗</a><a href="${plan.sources.transit}" target="_blank" rel="noreferrer">Get transit directions ↗</a><a href="${plan.sources.streetView}" target="_blank" rel="noreferrer">Open Street View ↗</a></div></section><p class="result-foot">Live place information from OpenStreetMap; forecast by Open-Meteo. ${allPlaces.length} place listings returned. Events and disruptions open live search or official calendars. Confirm hours, prices, event dates, alerts, and availability directly.</p>`;
  results.classList.add('visible');
  results.setAttribute('aria-busy', 'false');
  const resultHeading = results.querySelector('.result-head h2');
  resultHeading?.setAttribute('tabindex', '-1');
  resultHeading?.focus({ preventScroll: true });
}
async function planTrip() {
  latestController?.abort();
  latestController = new AbortController();
  submitButton.disabled = true;
  submitButton.innerHTML = 'Building your guide… <span class="arrow" aria-hidden="true">◌</span>';
  planStatus.textContent = `Building your guide for ${input.value.trim()}.`;
  results.className = 'results visible';
  results.setAttribute('aria-busy', 'true');
  results.innerHTML = '<div class="loading-state">Finding local places, detailed forecast data, events to check, and trip-specific suggestions… This usually takes a few seconds.</div>';
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    if (Capacitor.isNativePlatform() && !apiBaseUrl) throw new Error('Connect Nexo to its hosted planning API before building this mobile app.');
    const payload = { destination: input.value.trim(), startDate: startDateInput.value, durationDays: Number(durationInput.value), interests: interestsInput.value.trim() };
    const response = await fetch(`${apiBaseUrl}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: latestController.signal });
    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(response.ok
        ? 'The trip planner returned an unreadable response. Please try again.'
        : `The trip-planning service is unavailable right now (HTTP ${response.status}). Please try again shortly.`);
    }
    if (!response.ok) throw new Error(data.error || `The trip-planning service could not complete the request (HTTP ${response.status}).`);
    if (!data || typeof data !== 'object' || !data.destination) throw new Error('The trip planner returned an incomplete result. Please try again.');
    renderPlan(data, payload.interests);
    planStatus.textContent = `Your trip guide for ${data.destination} is ready.`;
  } catch (error) {
    if (error.name === 'AbortError') return;
    const message = error instanceof TypeError && /fetch/i.test(error.message)
      ? 'Nexo could not reach its planning service. Make sure the app and API server are running, then try again.'
      : error.message;
    results.setAttribute('aria-busy', 'false');
    results.innerHTML = `<div class="error-state" role="alert" tabindex="-1">${escapeHtml(message)}<br><br>Try again in a moment, or check your connection.</div>`;
    results.querySelector('.error-state')?.focus({ preventScroll: true });
    planStatus.textContent = `Could not build this guide. ${message}`;
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Build my guide <span class="arrow">↗</span>';
  }
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!input.value.trim()) { input.focus(); input.placeholder = 'Enter a destination…'; return; }
  if (!startDateInput.reportValidity()) return;
  if (!durationInput.reportValidity()) return;
  planTrip();
});
document.querySelectorAll('.chip').forEach((button) => button.addEventListener('click', () => {
  input.value = button.dataset.place;
  interestsInput.value = button.dataset.interest || '';
  durationInput.value = button.dataset.days || 3;
  updateDateLimit();
  planTrip();
}));
document.getElementById('about').addEventListener('click', () => {
  results.className = 'results visible';
  results.setAttribute('aria-busy', 'false');
  results.innerHTML = '<div class="loading-state">Nexo resolves the destination with OpenStreetMap, gathers nearby venue details, loads daily and hourly weather, then assembles a date-specific itinerary. Events and travel alerts link to live sources; place details can be incomplete, so confirm information with venues before you go.</div>';
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
});


// Open outbound links in the device browser when Nexo runs inside Capacitor.
document.addEventListener('click', (event) => {
  const link = event.target instanceof Element ? event.target.closest('a[target="_blank"]') : null;
  if (!link || !Capacitor.isNativePlatform()) return;
  event.preventDefault();
  Browser.open({ url: link.href });
});

// Cache the web app shell for repeat visits and basic offline startup.
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
}

let pendingInstallPrompt;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  pendingInstallPrompt = event;
  if (installButton) installButton.hidden = false;
});
const isIosSafari = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;
if (isIosSafari && installButton) installButton.hidden = false;
installButton?.addEventListener('click', async () => {
  if (pendingInstallPrompt) {
    pendingInstallPrompt.prompt();
    await pendingInstallPrompt.userChoice;
    pendingInstallPrompt = null;
    installButton.hidden = true;
  } else if (isIosSafari) {
    window.alert('To install Nexo, tap Share in Safari, then choose Add to Home Screen.');
  }
});
