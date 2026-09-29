'use strict';

/* =====================================================================
   Small helpers
   ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);

// Builds DOM nodes safely (text goes in as text, never as HTML)
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((kid) => {
    if (kid == null || kid === false) return;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  });
  return el;
}

const fmt = (n) => n.toLocaleString('en-IN', { maximumFractionDigits: n < 1000 ? 1 : 0 });
const fmtT = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
// "1 meal", "2 meals", "12 km"
const amountText = (n, unit) => fmt(n) + ' ' + (n === 1 && (unit === 'meals' || unit === 'items') ? unit.slice(0, -1) : unit);
const round3 = (n) => Math.round(n * 1000) / 1000;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Dates are handled as local "YYYY-MM-DD" strings
const toStr = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const todayStr = () => toStr(new Date());
function shiftDate(s, n) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return toStr(d); }
const niceDate = (s, withWeekday) => new Date(s + 'T12:00:00').toLocaleDateString('en-IN', withWeekday ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' });

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 4500);
}

/* =====================================================================
   Mobile menu and scroll-spy   (Intersection Observer API)
   ===================================================================== */
const menuButton = $('#menuButton');
const mainNav = $('#mainNav');

function setMenu(open) {
  mainNav.classList.toggle('hidden', !open);
  menuButton.setAttribute('aria-expanded', String(open));
}
menuButton.addEventListener('click', () => setMenu(mainNav.classList.contains('hidden')));
mainNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 1023px)').matches) setMenu(false);
  });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

const navLinks = [...document.querySelectorAll('a[data-nav]')];
function markActive(id) {
  navLinks.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + id)));
}
if ('IntersectionObserver' in window) {
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) markActive(entry.target.id); });
  }, { rootMargin: '-35% 0px -60% 0px' });
  ['home', 'activities', 'log', 'insights', 'pledges', 'events', 'apis'].forEach((id) => spy.observe(document.getElementById(id)));
}
window.addEventListener('scroll', () => {
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) markActive('about');
}, { passive: true });

/* =====================================================================
   Emission catalogue (illustrative kg CO2e per unit)
   ===================================================================== */
const DAILY_BUDGET = 6.3; // 2.3 t a year is about 6.3 kg a day
const CAT_ORDER = ['travel', 'energy', 'food', 'shopping'];
const CAT_NAME = { travel: 'Transportation', energy: 'Home energy', food: 'Food', shopping: 'Shopping' };
const CAT_COLOR = { travel: '#F2A900', energy: '#0F4C47', food: '#2F7D57', shopping: '#7FB2A6' };

const categories = {
  travel: {
    unit: 'km', start: 10, max: 20000, compare: true,
    options: [
      { id: 'metro', label: 'Metro', factor: 0.04 },
      { id: 'bus', label: 'City bus', factor: 0.05 },
      { id: 'two', label: 'Two-wheeler (petrol)', factor: 0.05 },
      { id: 'auto', label: 'Auto-rickshaw (CNG)', factor: 0.09 },
      { id: 'car', label: 'Car (petrol)', factor: 0.17 },
      { id: 'train', label: 'Train', factor: 0.03 },
      { id: 'flight', label: 'Domestic flight', factor: 0.15 },
      { id: 'walk', label: 'Walk or cycle', factor: 0 }
    ]
  },
  energy: {
    unit: 'kWh', start: 5, max: 5000, compare: false,
    note: 'Emissions depend on the fuel and the power grid, so using less energy is the main lever.',
    options: [
      { id: 'elec', label: 'Electricity', unit: 'kWh', factor: 0.7 },
      { id: 'lpg', label: 'LPG cooking gas', unit: 'kg', factor: 3.0, max: 100 }
    ]
  },
  food: {
    unit: 'meals', start: 1, max: 50, compare: true,
    options: [
      { id: 'veg', label: 'Vegetarian meal', factor: 0.6 },
      { id: 'egg', label: 'Egg meal', factor: 0.9 },
      { id: 'chicken', label: 'Chicken meal', factor: 1.5 },
      { id: 'mutton', label: 'Mutton meal', factor: 4.0 }
    ]
  },
  shopping: {
    unit: 'items', start: 1, max: 50, compare: false,
    note: 'Buying second-hand, repairing and keeping things longer avoids most of this.',
    options: [
      { id: 'tee', label: 'Cotton T-shirt', factor: 7 },
      { id: 'jeans', label: 'Jeans', factor: 25 },
      { id: 'phone', label: 'Smartphone', factor: 65 },
      { id: 'laptop', label: 'Laptop', factor: 300 }
    ]
  }
};

// Lookup by activity id: KIND.car -> { cat, label, unit, factor, max }
const KIND = Object.create(null);
const FACTORS = {};
for (const [cat, c] of Object.entries(categories)) {
  c.options.forEach((o) => {
    KIND[o.id] = { cat, label: o.label, unit: o.unit || c.unit, factor: o.factor, max: o.max || c.max };
    FACTORS[o.id] = o.factor;
  });
}

/* =====================================================================
   Web Storage API: the log, pledges and reminder settings persist in
   localStorage; the unsent form draft lives in sessionStorage.
   ===================================================================== */
const STORE_KEY = 'cfi.state.v1';
const DRAFT_KEY = 'cfi.draft';
let storageOK = true;

const store = {
  get(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { storageOK = false; return false; }
  }
};

function makeEntry(date, kind, amount, sample) {
  const k = KIND[kind];
  return { id: uid(), ts: sample ? 0 : Date.now(), date, cat: k.cat, kind, label: k.label, amount, unit: k.unit, kg: round3(amount * k.factor), sample: !!sample };
}

// Accepts only entries that match the catalogue; recalculates kg instead of trusting the file
function cleanEntry(e) {
  if (!e || typeof e !== 'object' || typeof e.kind !== 'string' || !(e.kind in KIND)) return null;
  const k = KIND[e.kind];
  const amount = Number(e.amount);
  if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || Number.isNaN(Date.parse(e.date + 'T00:00:00Z'))) return null;
  if (!(amount > 0) || amount > k.max) return null;
  return { id: typeof e.id === 'string' && e.id ? e.id.slice(0, 40) : uid(), ts: Number(e.ts) || 0, date: e.date, cat: k.cat, kind: e.kind, label: k.label, amount, unit: k.unit, kg: round3(amount * k.factor), sample: !!e.sample };
}
function cleanPledge(p) {
  if (!p || typeof p.id !== 'string' || typeof p.title !== 'string' || !(Number(p.saving) >= 0)) return null;
  return { id: p.id.slice(0, 40), title: p.title.slice(0, 160), saving: Number(p.saving) };
}

// Sample data so the charts are not empty on the first visit (deterministic, flagged as sample)
function makeSample() {
  const today = todayStr();
  let seed = 20260921;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out = [];
  const add = (age, kind, amount) => out.push(makeEntry(shiftDate(today, -age), kind, amount, true));
  for (let age = 59; age >= 0; age--) {
    const dow = new Date(shiftDate(today, -age) + 'T12:00:00').getDay();
    const weekday = dow >= 1 && dow <= 5;
    const r = rnd();
    if (weekday) { if (r < 0.5) add(age, 'car', 26); else if (r < 0.8) add(age, 'metro', 28); else add(age, 'auto', 10); }
    else if (r < 0.6) add(age, 'car', 20);
    add(age, 'elec', Math.round((2 + rnd() * 1.2) * 10) / 10);
    const m = rnd();
    add(age, m < 0.55 ? 'veg' : m < 0.65 ? 'egg' : m < 0.92 ? 'chicken' : 'mutton', weekday ? 1 : 2);
    if (age % 4 === 0) add(age, 'lpg', 0.5);
  }
  add(5, 'tee', 1); add(17, 'jeans', 1); add(33, 'phone', 1); add(48, 'tee', 2);
  return out;
}

const defaultReminder = () => ({ enabled: false, time: '20:00', lastFired: '' });

function loadState() {
  const saved = store.get(STORE_KEY);
  if (saved && Array.isArray(saved.entries)) {
    const rem = saved.reminder && typeof saved.reminder === 'object' ? saved.reminder : {};
    return {
      entries: saved.entries.map(cleanEntry).filter(Boolean),
      pledges: Array.isArray(saved.pledges) ? saved.pledges.map(cleanPledge).filter(Boolean) : [],
      reminder: { ...defaultReminder(), enabled: !!rem.enabled, time: /^\d{2}:\d{2}$/.test(rem.time) ? rem.time : '20:00', lastFired: typeof rem.lastFired === 'string' ? rem.lastFired : '' }
    };
  }
  const fresh = { entries: makeSample(), pledges: [], reminder: defaultReminder() };
  store.set(STORE_KEY, fresh);
  return fresh;
}

let state = loadState();
const save = () => store.set(STORE_KEY, state);

// Keep several open tabs in sync
window.addEventListener('storage', (e) => {
  if (e.key === STORE_KEY && e.newValue) { state = loadState(); refreshAll(); updateReminderUI(); }
});

/* =====================================================================
   Web Workers API: the analysis runs off the main thread.
   analyse() is a pure function. Its source is copied into the worker,
   and it is also the fallback when workers are not available.
   ===================================================================== */
function analyse(entries, today, budget, F) {
  const DAY = 86400000;
  const t = (s) => Date.parse(s + 'T00:00:00Z');
  const todayT = t(today);
  const r1 = (n) => Math.round(n * 10) / 10;
  const cats = { travel: 0, energy: 0, food: 0, shopping: 0 };
  const kinds = {};
  const byDay = new Array(14).fill(0);
  let monthTotal = 0, prevTotal = 0, todayTotal = 0;

  for (const e of entries) {
    const age = Math.round((todayT - t(e.date)) / DAY); // 0 = today
    if (age < 0) continue;
    if (age === 0) todayTotal += e.kg;
    if (age < 14) byDay[13 - age] += e.kg;
    if (age < 30) {
      monthTotal += e.kg;
      cats[e.cat] += e.kg;
      const k = kinds[e.kind] || (kinds[e.kind] = { amount: 0, kg: 0 });
      k.amount += e.amount;
      k.kg += e.kg;
    } else if (age < 60) {
      prevTotal += e.kg;
    }
  }

  const recs = [];
  const push = (id, title, detail, saving) => { if (saving >= 0.5) recs.push({ id, title, detail, saving: r1(saving) }); };

  if (kinds.car) {
    const km = kinds.car.amount;
    push('car-metro', 'Take the metro or a bus for half your car trips',
      'You drove ' + r1(km) + ' km in the last 30 days. Moving half of that to the metro saves the most for the least change.',
      km * 0.5 * (F.car - F.metro));
  }
  if (kinds.auto) {
    const km = kinds.auto.amount;
    push('auto-metro', 'Use the metro instead of an auto-rickshaw on regular routes',
      'You rode ' + r1(km) + ' km by auto-rickshaw. Switching half of it to the metro or a bus trims those routes.',
      km * 0.5 * (F.auto - F.metro));
  }
  if (kinds.flight) {
    const km = kinds.flight.amount;
    push('flight-train', 'Take the train instead of flying',
      'You flew ' + r1(km) + ' km. The same distance by train emits about a fifth as much.',
      km * (F.flight - F.train));
  }
  if (kinds.elec) {
    const kwh = kinds.elec.amount;
    push('ac', 'Set the air conditioner to 24–26 °C',
      'You used ' + r1(kwh) + ' kWh of electricity. A few degrees higher on the thermostat cuts cooling use. This estimate assumes 10% less.',
      kwh * 0.1 * F.elec);
  }
  if (kinds.mutton) {
    const n = Math.min(Math.floor(kinds.mutton.amount), 4);
    if (n >= 1) push('mutton-veg', 'Swap ' + n + ' mutton meal' + (n > 1 ? 's' : '') + ' for vegetarian ones',
      'Mutton is the highest-carbon meal on the list. Each swap saves about ' + r1(F.mutton - F.veg) + ' kg.',
      n * (F.mutton - F.veg));
  }
  if (kinds.chicken) {
    const n = Math.min(Math.floor(kinds.chicken.amount), 4);
    if (n >= 1) push('chicken-veg', 'Swap ' + n + ' chicken meal' + (n > 1 ? 's' : '') + ' for vegetarian ones',
      'Each swap saves about ' + r1(F.chicken - F.veg) + ' kg, so a few a month adds up without changing how you eat the rest of the time.',
      n * (F.chicken - F.veg));
  }
  if (cats.shopping > 0) {
    push('shop-secondhand', 'Repair, or buy second-hand, half of what you buy new',
      'Clothes and devices made ' + r1(cats.shopping) + ' kg of your last 30 days. Second-hand and repaired goods avoid most of that.',
      cats.shopping * 0.5);
  }
  recs.sort((a, b) => b.saving - a.saving);

  return { today, cats, byDay, monthTotal, prevTotal, todayTotal, recs: recs.slice(0, 5) };
}

let worker = null;
let reqId = 0;
let analysis = null;
let analysisMode = 'pending';

function setupWorker() {
  if (typeof Worker !== 'function') return;
  try {
    const source = "'use strict';\nconst analyse = " + analyse.toString() + ";\n" +
      "self.onmessage = (e) => { const d = e.data; self.postMessage({ id: d.id, result: analyse(d.entries, d.today, d.budget, d.factors) }); };";
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = (e) => onAnalysis(e.data.result, e.data.id, 'worker');
    worker.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); dropWorker(); };
  } catch { worker = null; }
}
function dropWorker() {
  if (worker) worker.terminate();
  worker = null;
  runAnalysis();
}
function runAnalysis() {
  const payload = { id: ++reqId, entries: state.entries, today: todayStr(), budget: DAILY_BUDGET, factors: FACTORS };
  if (worker) {
    try { worker.postMessage(payload); return; } catch { worker = null; }
  }
  onAnalysis(analyse(payload.entries, payload.today, payload.budget, payload.factors), payload.id, 'main');
}
function onAnalysis(result, id, mode) {
  if (id !== reqId) return; // a newer request is already on its way
  analysis = result;
  analysisMode = mode;
  renderInsights();
  renderSuggestions();
  renderPledges();
  drawAll(true);
  refreshApiTable();
}

/* =====================================================================
   Estimator form   (Constraint Validation API)
   ===================================================================== */
const form = $('#estimator');
const kindSelect = $('#kind');
const amountInput = $('#amount');
const dateInput = $('#entry-date');
const unitLabel = $('#unit');
const amountError = $('#amount-error');
const dateError = $('#date-error');
const resultNum = $('#result-num');
const resultContext = $('#result-context');
const resultTip = $('#result-tip');
const currentKey = () => document.querySelector('input[name="category"]:checked').value;
const currentOption = () => categories[currentKey()].options[Number(kindSelect.value)];

function fillOptions(key) {
  kindSelect.innerHTML = '';
  categories[key].options.forEach((opt, i) => kindSelect.append(h('option', { value: String(i) }, opt.label)));
  amountInput.value = categories[key].start;
}

function validateAmount() {
  const cat = categories[currentKey()];
  const opt = currentOption();
  const unit = opt.unit || cat.unit;
  const max = opt.max || cat.max;
  amountInput.max = String(max);
  amountInput.setCustomValidity('');
  const v = amountInput.validity;
  let msg = '';
  if (v.valueMissing || v.badInput) msg = 'Enter how much you did, for example 12.5.';
  else if (v.rangeUnderflow) msg = 'Enter an amount above 0.';
  else if (v.rangeOverflow) msg = 'That is more than ' + fmt(max) + ' ' + unit + ' in one entry. Check the number.';
  if (msg) amountInput.setCustomValidity(msg);
  amountError.textContent = msg;
  if (msg) amountInput.setAttribute('aria-invalid', 'true'); else amountInput.removeAttribute('aria-invalid');
  return !msg;
}
function validateDate() {
  dateInput.max = todayStr();
  dateInput.min = shiftDate(todayStr(), -730);
  dateInput.setCustomValidity('');
  const v = dateInput.validity;
  let msg = '';
  if (v.valueMissing || v.badInput) msg = 'Choose the date of the activity.';
  else if (v.rangeOverflow) msg = 'The date cannot be in the future.';
  else if (v.rangeUnderflow) msg = 'Choose a date within the last two years.';
  if (msg) dateInput.setCustomValidity(msg);
  dateError.textContent = msg;
  if (msg) dateInput.setAttribute('aria-invalid', 'true'); else dateInput.removeAttribute('aria-invalid');
  return !msg;
}

function update() {
  const cat = categories[currentKey()];
  const opt = currentOption();
  unitLabel.textContent = opt.unit || cat.unit;

  if (!validateAmount()) {
    resultNum.textContent = '0';
    resultContext.textContent = 'Fix the amount to see the estimate.';
    resultTip.textContent = '';
    return;
  }
  const amount = parseFloat(amountInput.value);
  const kg = amount * opt.factor;
  resultNum.textContent = fmt(kg);
  resultContext.textContent = kg < DAILY_BUDGET
    ? `That is ${Math.round((kg / DAILY_BUDGET) * 100)}% of one day’s budget of ${DAILY_BUDGET} kg.`
    : `That is ${fmt(kg / DAILY_BUDGET)} days of a ${DAILY_BUDGET} kg daily budget.`;

  if (cat.compare) {
    const best = cat.options.filter((o) => o.factor > 0 && (opt.id === 'flight' ? o.id === 'train' : o.id !== 'train')).reduce((a, b) => (b.factor < a.factor ? b : a));
    if (opt.factor === 0) {
      resultTip.textContent = 'Zero emissions. Nothing to cut here.';
    } else if (opt.factor > best.factor) {
      const alt = amount * best.factor;
      resultTip.textContent = `Choosing ${lowerFirst(best.label)} instead would emit ${fmt(alt)} kg, saving ${fmt(kg - alt)} kg.`;
    } else {
      resultTip.textContent = 'This is already among the lowest-carbon choices here.';
    }
  } else {
    resultTip.textContent = cat.note;
  }
}

// sessionStorage: survive a reload in this tab without saving an unsent entry
function saveDraft() {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ cat: currentKey(), kind: kindSelect.value, amount: amountInput.value })); } catch { /* storage may be blocked */ }
}
function restoreDraft() {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    if (!d || !categories[d.cat]) return;
    const radio = document.getElementById('cat-' + d.cat);
    radio.checked = true;
    fillOptions(d.cat);
    if (categories[d.cat].options[Number(d.kind)]) kindSelect.value = String(Number(d.kind));
    if (d.amount !== '') amountInput.value = d.amount;
  } catch { /* ignore a broken draft */ }
}

document.querySelectorAll('input[name="category"]').forEach((radio) => {
  radio.addEventListener('change', () => { fillOptions(currentKey()); update(); saveDraft(); });
});
kindSelect.addEventListener('change', () => { update(); saveDraft(); });
amountInput.addEventListener('input', () => { update(); saveDraft(); });
dateInput.addEventListener('input', validateDate);

const sumForDate = (date) => state.entries.reduce((s, e) => (e.date === date ? s + e.kg : s), 0);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const okDate = validateDate();
  const okAmount = validateAmount();
  if (!okDate || !okAmount) {
    (okAmount ? dateInput : amountInput).focus();
    return;
  }
  const opt = currentOption();
  const amount = parseFloat(amountInput.value);
  const entry = makeEntry(dateInput.value, opt.id, amount, false);
  const before = sumForDate(entry.date);
  state.entries.push(entry);
  commit();
  toast(`Added ${entry.label}, ${amountText(entry.amount, entry.unit)}: ${fmt(entry.kg)} kg CO₂e.`);
  const after = before + entry.kg;
  if (entry.date === todayStr() && before <= DAILY_BUDGET && after > DAILY_BUDGET) {
    const body = `Today is at ${fmt(after)} kg, over the ${DAILY_BUDGET} kg daily budget.`;
    if (!notify('Over today’s carbon budget', body, 'budget-alert')) setTimeout(() => toast(body), 1200);
  }
});

/* =====================================================================
   Geolocation API: measure a trip
   ===================================================================== */
const trip = { active: false, demo: false, watchId: null, feed: null, clock: null, last: null, meters: 0, startedAt: 0, mode: 'car' };
const tripEls = {
  mode: $('#trip-mode'), start: $('#trip-start'), stop: $('#trip-stop'), demo: $('#trip-demo'),
  dist: $('#trip-distance'), time: $('#trip-time'), pos: $('#trip-pos'), status: $('#trip-status')
};
const GEO_ERRORS = {
  1: 'Location permission was denied. Allow location for this site in your browser, or try the demo walk.',
  2: 'Your position is not available right now. Check that location services are turned on.',
  3: 'Finding your position timed out. Try again outdoors or with a better signal.'
};

categories.travel.options.filter((o) => o.id !== 'flight').forEach((o) => tripEls.mode.append(h('option', { value: o.id }, o.label)));
tripEls.mode.value = 'car';

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function setTripUI(active) {
  trip.active = active;
  tripEls.start.disabled = active;
  tripEls.demo.disabled = active;
  tripEls.stop.disabled = !active;
  tripEls.mode.disabled = active;
}
function tickClock() {
  const s = Math.floor((Date.now() - trip.startedAt) / 1000);
  tripEls.time.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function onPosition(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  tripEls.pos.textContent = `${latitude.toFixed(4)}, ${longitude.toFixed(4)} (±${Math.round(accuracy)} m)${trip.demo ? ' simulated' : ''}`;
  if (accuracy > 80) { tripEls.status.textContent = `Waiting for a stronger GPS signal (±${Math.round(accuracy)} m).`; return; }
  tripEls.status.textContent = trip.demo ? 'Demo mode: positions are simulated and no GPS is used.' : 'Tracking. Keep this page open while you travel.';
  if (!trip.last) { trip.last = { latitude, longitude }; return; }
  const d = haversine(trip.last.latitude, trip.last.longitude, latitude, longitude);
  if (d >= Math.max(5, accuracy * 0.5)) { // ignore GPS jitter
    trip.meters += d;
    trip.last = { latitude, longitude };
    tripEls.dist.textContent = (trip.meters / 1000).toFixed(2);
  }
}
function beginTrip(demo) {
  trip.demo = demo; trip.last = null; trip.meters = 0; trip.startedAt = Date.now();
  trip.mode = tripEls.mode.value;
  tripEls.dist.textContent = '0.00';
  tripEls.time.textContent = '0:00';
  tripEls.pos.textContent = 'Locating…';
  setTripUI(true);
  trip.clock = setInterval(tickClock, 1000);
}
tripEls.start.addEventListener('click', () => {
  if (!('geolocation' in navigator)) {
    tripEls.status.textContent = 'This browser does not support geolocation. Try the demo walk instead.';
    return;
  }
  beginTrip(false);
  tripEls.status.textContent = 'Asking for your location…';
  trip.watchId = navigator.geolocation.watchPosition(onPosition, (err) => {
    let msg = GEO_ERRORS[err.code] || 'Could not read your position.';
    if (!window.isSecureContext) msg += ' This page is not on https or localhost, which browsers require for location.';
    tripEls.status.textContent = msg;
    if (err.code === 1) endTrip(false); // permission denied: nothing to wait for
  }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
});
tripEls.demo.addEventListener('click', () => {
  beginTrip(true);
  let lat = 20.5937; const lon = 78.9629; // neutral point in India
  tripEls.status.textContent = 'Demo mode: positions are simulated and no GPS is used.';
  trip.feed = setInterval(() => { lat += 0.0009; onPosition({ coords: { latitude: lat, longitude: lon, accuracy: 8 } }); }, 600);
  onPosition({ coords: { latitude: lat, longitude: lon, accuracy: 8 } });
});
tripEls.stop.addEventListener('click', () => endTrip(true));

function endTrip(useDistance) {
  if (!trip.active) return;
  if (trip.watchId != null) navigator.geolocation.clearWatch(trip.watchId);
  clearInterval(trip.feed); clearInterval(trip.clock);
  trip.watchId = null;
  setTripUI(false);
  if (!useDistance) return;
  const km = trip.meters / 1000;
  if (km < 0.05) { tripEls.status.textContent = 'That trip was under 50 m, so nothing was added.'; return; }
  const amount = Math.max(0.1, Math.round(km * 10) / 10);
  document.getElementById('cat-travel').checked = true;
  fillOptions('travel');
  const idx = categories.travel.options.findIndex((o) => o.id === trip.mode);
  kindSelect.value = String(Math.max(0, idx));
  amountInput.value = amount;
  update(); saveDraft();
  tripEls.status.textContent = `Trip of ${amount} km added to the form. Check it and press Add to my log.`;
  form.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
  $('#add-button').focus({ preventScroll: true });
}

/* =====================================================================
   Notifications API
   ===================================================================== */
const remindEls = { time: $('#remind-time'), toggle: $('#remind-toggle'), test: $('#remind-test'), status: $('#remind-status') };
const notifSupported = () => 'Notification' in window;
const hhmm = () => { const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); };

function notify(title, body, tag) {
  if (!notifSupported() || Notification.permission !== 'granted') return false;
  try {
    const n = new Notification(title, { body, tag });
    n.onclick = () => { window.focus(); n.close(); };
    return true;
  } catch { return false; } // some mobile browsers only allow notifications through a service worker
}
async function askPermission() {
  if (!notifSupported()) { toast('This browser does not support notifications.'); return false; }
  let p = Notification.permission;
  if (p === 'default') { try { p = await Notification.requestPermission(); } catch { p = Notification.permission; } }
  refreshApiTable();
  if (p !== 'granted') toast('Notifications are blocked. Allow them in your browser’s site settings to use reminders.');
  return p === 'granted';
}
function updateReminderUI() {
  const r = state.reminder;
  remindEls.time.value = r.time;
  remindEls.toggle.textContent = r.enabled ? 'Turn off reminders' : 'Turn on reminders';
  remindEls.toggle.setAttribute('aria-pressed', String(r.enabled));
  const perm = notifSupported() ? Notification.permission : 'unsupported';
  remindEls.status.textContent = {
    unsupported: 'This browser does not support notifications.',
    denied: 'Notifications are blocked for this site. Change this in your browser’s site settings.',
    default: 'Notifications have not been allowed yet. Turn on reminders to be asked.',
    granted: r.enabled ? `Reminders are on for ${r.time}. Keep this page open in a tab to receive them.` : 'Notifications are allowed. Reminders are off.'
  }[perm];
}
remindEls.toggle.addEventListener('click', async () => {
  const r = state.reminder;
  if (r.enabled) { r.enabled = false; }
  else {
    if (!(await askPermission())) { updateReminderUI(); return; }
    r.enabled = true;
    if (hhmm() >= r.time) r.lastFired = todayStr(); // do not fire straight away for a time already passed
  }
  save(); updateReminderUI();
});
remindEls.time.addEventListener('input', () => {
  if (!remindEls.time.value) return;
  state.reminder.time = remindEls.time.value;
  if (hhmm() >= state.reminder.time) state.reminder.lastFired = todayStr();
  save(); updateReminderUI();
});
remindEls.test.addEventListener('click', async () => {
  if (!(await askPermission())) return;
  if (!notify('CarbonFootprint India', 'This is a test. Reminders will look like this.', 'test')) toast('Could not show a notification here. Check your browser settings.');
});
function checkReminder() {
  const r = state.reminder;
  const today = todayStr();
  if (!r.enabled || r.lastFired === today || hhmm() < r.time) return;
  r.lastFired = today; save();
  if (sumForDate(today) > 0) return; // already logged today
  const body = 'You have not logged anything today. It takes about a minute.';
  if (!notify('Log today’s carbon', body, 'daily-log')) toast(body);
}
setInterval(checkReminder, 30000);

/* =====================================================================
   Rendering: receipt, log, category list
   ===================================================================== */
function renderReceipt() {
  const today = todayStr();
  const dateEl = $('#receipt-date');
  dateEl.setAttribute('datetime', today);
  dateEl.textContent = 'Today, ' + niceDate(today);

  const groups = new Map();
  state.entries.filter((e) => e.date === today).forEach((e) => {
    const g = groups.get(e.kind) || { kind: e.kind, amount: 0, kg: 0 };
    g.amount += e.amount; g.kg += e.kg;
    groups.set(e.kind, g);
  });
  const lines = [...groups.values()].sort((a, b) => b.kg - a.kg);
  const list = $('#receipt-lines');
  list.replaceChildren();

  const lineText = (g) => {
    const k = KIND[g.kind];
    return `${k.label}, ${fmt(g.amount)}${['km', 'kWh', 'kg'].includes(k.unit) ? ' ' + k.unit : ''}`;
  };
  const dots = () => h('span', { class: 'flex-1 border-b border-dotted border-ink/30', 'aria-hidden': 'true' });
  const MAX_LINES = 6;

  if (!lines.length) {
    list.append(h('li', { class: 'text-ink/70' }, 'Nothing logged today yet. Add an activity to start your receipt.'));
  }
  lines.slice(0, MAX_LINES).forEach((g, i) => {
    const largest = i === 0 && lines.length > 1;
    list.append(h('li', { class: 'flex items-baseline gap-2' + (largest ? ' -mx-3 rounded bg-marigold/25 px-3 py-1.5' : '') },
      h('span', {}, lineText(g), largest ? h('span', { class: 'ml-1 rounded-sm bg-marigold px-1.5 py-0.5 text-xs font-bold text-spruce-deep' }, 'Largest') : null),
      dots(),
      h('span', { class: 'font-semibold tabular-nums' }, fmt(g.kg) + ' kg')));
  });
  if (lines.length > MAX_LINES) {
    const rest = lines.slice(MAX_LINES);
    list.append(h('li', { class: 'flex items-baseline gap-2' }, h('span', {}, `${rest.length} more activities`), dots(), h('span', { class: 'font-semibold tabular-nums' }, fmt(rest.reduce((s, g) => s + g.kg, 0)) + ' kg')));
  }

  const total = lines.reduce((s, g) => s + g.kg, 0);
  $('#receipt-total').textContent = fmt(total);
  $('#receipt-note').textContent = `A 2.3 t a year target allows ${DAILY_BUDGET} kg a day. ` + (total === 0
    ? 'Log something to see where today stands.'
    : total > DAILY_BUDGET ? `Today is ${fmt(total - DAILY_BUDGET)} kg over.` : `Today is ${fmt(DAILY_BUDGET - total)} kg under.`);
}

let showAllRows = false;
function renderLog() {
  const body = $('#log-body');
  body.replaceChildren();
  const rows = [...state.entries].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  const shown = showAllRows ? rows : rows.slice(0, 8);

  if (!rows.length) {
    const cell = h('td', { colspan: '5', class: 'px-4 py-8 text-center text-ink/70' }, 'Nothing logged yet. Add an activity above, or ',
      h('button', { type: 'button', class: 'font-semibold text-spruce underline underline-offset-4', onclick: () => { state.entries = makeSample(); commit(); } }, 'load sample data'), '.');
    body.append(h('tr', {}, cell));
  }
  shown.forEach((e) => {
    body.append(h('tr', { class: 'border-b border-ink/10 last:border-0', 'data-id': e.id, title: 'Double-click to log this again today' },
      h('td', { class: 'whitespace-nowrap px-4 py-2.5' }, h('time', { datetime: e.date }, niceDate(e.date, true))),
      h('td', { class: 'px-4 py-2.5' }, e.label, e.sample ? h('span', { class: 'ml-2 rounded-sm bg-sage px-1.5 py-0.5 text-xs text-ink/70' }, 'Sample') : null),
      h('td', { class: 'whitespace-nowrap px-4 py-2.5 text-right tabular-nums' }, amountText(e.amount, e.unit)),
      h('td', { class: 'px-4 py-2.5 text-right font-semibold tabular-nums' }, fmt(e.kg)),
      h('td', { class: 'px-4 py-2.5 text-right' },
        h('button', { type: 'button', class: 'rounded px-2 py-1 text-sm font-semibold text-red-700 hover:bg-sage', onclick: () => removeEntry(e.id) },
          'Remove', h('span', { class: 'sr-only' }, ` ${e.label}, ${amountText(e.amount, e.unit)}, ${niceDate(e.date)}`)))));
  });

  const more = $('#log-more');
  more.classList.toggle('hidden', rows.length <= 8);
  more.textContent = showAllRows ? 'Show fewer' : `Show all ${rows.length} entries`;
  $('#log-summary').textContent = rows.length
    ? `${rows.length} entries, ${fmt(rows.reduce((s, e) => s + e.kg, 0))} kg CO₂e in total.` + (storageOK ? '' : ' Saving is turned off in this browser, so this log will be lost when you close the page.')
    : 'No entries yet.';
  const banner = $('#sample-banner');
  const hasSample = state.entries.some((e) => e.sample);
  banner.classList.toggle('hidden', !hasSample);
  banner.classList.toggle('flex', hasSample);
}
$('#log-more').addEventListener('click', () => { showAllRows = !showAllRows; renderLog(); });
function removeEntry(id) {
  state.entries = state.entries.filter((e) => e.id !== id);
  commit();
  toast('Entry removed.');
}
$('#clear-sample').addEventListener('click', () => {
  state.entries = state.entries.filter((e) => !e.sample);
  commit();
  toast('Sample data cleared.');
});

function renderInsights() {
  const a = analysis;
  const total = a.monthTotal;
  $('#stat-today').textContent = fmt(a.todayTotal);
  $('#stat-month').textContent = fmt(total);
  const annualT = (total / 30) * 365 / 1000;
  $('#stat-year').textContent = total > 0 ? fmtT(annualT) : '0';

  $('#insights-title').textContent = total > 0 ? `Where the last 30 days’ ${fmt(total)} kg came from` : 'Log a few activities to see where your carbon goes';
  let lead = 'Footprints are lopsided. Seeing the split shows which habit is worth changing first.';
  if (total > 0 && a.prevTotal > 0) {
    const pct = Math.round((Math.abs(total - a.prevTotal) / a.prevTotal) * 100);
    lead = `${pct}% ${total <= a.prevTotal ? 'lower' : 'higher'} than the 30 days before. ` + (annualT <= 2.3 ? 'At this pace you would land under the 2.3 t a year target.' : `At this pace you would emit ${fmtT(annualT)} t a year, against a 2.3 t target.`);
  } else if (total > 0) {
    lead += ' Keep logging and this page will compare you with earlier weeks.';
  }
  if (state.entries.some((e) => e.sample)) lead += ' Includes sample data.';
  $('#insights-lead').textContent = lead;

  // Budget meter (HTML5 <meter>)
  const meter = $('#budget-meter');
  meter.max = Math.max(DAILY_BUDGET * 2, a.todayTotal);
  meter.value = a.todayTotal;
  $('#budget-text').textContent = a.todayTotal > DAILY_BUDGET
    ? `${fmt(a.todayTotal)} kg so far, ${fmt(a.todayTotal - DAILY_BUDGET)} kg over budget.`
    : `${fmt(a.todayTotal)} kg so far, ${fmt(DAILY_BUDGET - a.todayTotal)} kg left in today’s budget.`;

  // Category list (also the text alternative to the donut)
  const list = $('#cat-list');
  list.replaceChildren();
  const ordered = CAT_ORDER.map((k) => [k, a.cats[k]]).sort((x, y) => y[1] - x[1]);
  const top = Math.max(...ordered.map((x) => x[1]), 0.0001);
  ordered.forEach(([key, val]) => {
    const share = total > 0 ? Math.round((val / total) * 100) : 0;
    list.append(h('li', { 'data-cat': key, tabindex: '0' },
      h('div', { class: 'flex items-center justify-between gap-3 text-sm' },
        h('span', { class: 'flex items-center gap-2 font-semibold' }, h('span', { class: 'inline-block h-3 w-3 rounded-sm', style: `background:${CAT_COLOR[key]}`, 'aria-hidden': 'true' }), CAT_NAME[key]),
        h('span', { class: 'tabular-nums' }, `${fmt(val)} kg · ${share}%`)),
      h('div', { class: 'mt-1.5 h-3 rounded-sm bg-sage', 'aria-hidden': 'true' },
        h('div', { class: 'h-3 rounded-sm', style: `width:${(val / top) * 100}%;background:${CAT_COLOR[key]}` }))));
  });
  $('#cat-total').textContent = fmt(total);

  // Table version of the bar chart
  const tbody = $('#bars-table');
  tbody.replaceChildren();
  dayLabels().forEach((date, i) => {
    const v = a.byDay[i];
    tbody.append(h('tr', { class: 'border-b border-ink/10' },
      h('th', { scope: 'row', class: 'py-2 pr-4 font-normal' }, h('time', { datetime: date }, niceDate(date, true))),
      h('td', { class: 'py-2 pr-4 text-right tabular-nums' }, fmt(v)),
      h('td', { class: 'py-2' }, v === 0 ? 'Nothing logged' : v > DAILY_BUDGET ? `${fmt(v - DAILY_BUDGET)} kg over` : 'Within budget')));
  });

  $('#worker-status').textContent = analysisMode === 'worker'
    ? 'These figures were calculated in a Web Worker, off the main thread.'
    : 'Web Workers are not available here, so these figures were calculated on the main thread.';

  const over = a.byDay.filter((v) => v > DAILY_BUDGET).length;
  const maxV = Math.max(...a.byDay);
  const maxIdx = a.byDay.indexOf(maxV);
  $('#donut').setAttribute('aria-label', total > 0
    ? 'Donut chart of the last 30 days: ' + ordered.map(([k, v]) => `${CAT_NAME[k]} ${fmt(v)} kg`).join(', ') + '.'
    : 'Donut chart with no data yet.');
  $('#bars').setAttribute('aria-label', maxV > 0
    ? `Bar chart of daily emissions for the last 14 days. ${over} days went over the ${DAILY_BUDGET} kg budget. The highest day was ${niceDate(dayLabels()[maxIdx], true)} at ${fmt(maxV)} kg.`
    : 'Bar chart of daily emissions for the last 14 days. Nothing logged yet.');
}
const dayLabels = () => Array.from({ length: 14 }, (_, i) => shiftDate(analysis ? analysis.today : todayStr(), i - 13));

/* =====================================================================
   Canvas API: donut and bar charts
   ===================================================================== */
const donut = $('#donut');
const bars = $('#bars');
let barHover = -1;
let barGeom = null;
let donutShown = false;
let donutHi = null; // category highlighted by mouseover

function fitCanvas(c) {
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth, hgt = c.clientHeight;
  if (!w || !hgt) return null;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(hgt * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hgt * dpr); }
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hgt);
  return { ctx, w, h: hgt };
}

function drawDonut(progress) {
  const f = fitCanvas(donut);
  if (!f || !analysis) return;
  const { ctx, w, h: hgt } = f;
  const cx = w / 2, cy = hgt / 2;
  const R = Math.min(w, hgt) / 2 - 4, lw = R * 0.28, r = R - lw / 2;
  const total = analysis.monthTotal;

  ctx.lineWidth = lw; ctx.lineCap = 'butt';
  ctx.strokeStyle = '#EAF1EC';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

  if (total > 0) {
    let start = -Math.PI / 2;
    CAT_ORDER.forEach((key) => {
      const v = analysis.cats[key];
      if (v <= 0) return;
      const sweep = (v / total) * Math.PI * 2 * progress;
      ctx.beginPath();
      ctx.strokeStyle = CAT_COLOR[key];
      ctx.globalAlpha = donutHi && donutHi !== key ? 0.25 : 1;
      ctx.arc(cx, cy, r, start, start + Math.max(sweep - 0.03, 0.002));
      ctx.stroke();
      start += sweep;
    });
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0F4C47';
  ctx.font = `${Math.round(R * 0.3)}px "Young Serif", Georgia, serif`;
  ctx.globalAlpha = 1;
  ctx.fillText(fmt(donutHi ? analysis.cats[donutHi] : total), cx, cy - R * 0.06);
  ctx.fillStyle = 'rgba(23,48,45,.72)';
  ctx.font = `600 ${Math.max(11, Math.round(R * 0.105))}px "Hanken Grotesk", system-ui, sans-serif`;
  ctx.fillText(donutHi ? CAT_NAME[donutHi] : 'kg CO₂e, 30 days', cx, cy + R * 0.2);
}

function drawBars() {
  const f = fitCanvas(bars);
  if (!f || !analysis) return;
  const { ctx, w, h: hgt } = f;
  const vals = analysis.byDay;
  const pad = { l: 34, r: 8, t: 30, b: 26 };
  const iw = w - pad.l - pad.r, ih = hgt - pad.t - pad.b;
  const niceMax = Math.max(4, Math.ceil(Math.max(DAILY_BUDGET * 1.3, ...vals) / 2) * 2);
  const y = (v) => pad.t + ih - (v / niceMax) * ih;
  const slot = iw / vals.length;
  const bw = Math.min(slot * 0.62, 30);
  barGeom = { padL: pad.l, slot, count: vals.length };

  ctx.font = '12px "Hanken Grotesk", system-ui, sans-serif';
  ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  ctx.lineWidth = 1;
  [0, niceMax / 2, niceMax].forEach((tick) => {
    ctx.strokeStyle = 'rgba(23,48,45,.14)';
    ctx.beginPath(); ctx.moveTo(pad.l, y(tick) + 0.5); ctx.lineTo(w - pad.r, y(tick) + 0.5); ctx.stroke();
    ctx.fillStyle = 'rgba(23,48,45,.7)';
    ctx.fillText(String(tick), pad.l - 6, y(tick));
  });

  const labels = dayLabels();
  vals.forEach((v, i) => {
    const x = pad.l + slot * i + (slot - bw) / 2;
    const top = y(v);
    ctx.fillStyle = v > DAILY_BUDGET ? '#C77F00' : '#0F4C47';
    if (v > 0) ctx.fillRect(x, top, bw, y(0) - top);
    if (i === barHover) { ctx.strokeStyle = '#17302D'; ctx.lineWidth = 2; ctx.strokeRect(x - 2, Math.min(top, y(0) - 2) - 2, bw + 4, Math.max(y(0) - top, 2) + 4); ctx.lineWidth = 1; }
    // x labels: day of the month, every second one on narrow screens
    if (slot >= 24 || i % 2 === vals.length % 2) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = i === vals.length - 1 ? '#0F4C47' : 'rgba(23,48,45,.72)';
      ctx.font = (i === vals.length - 1 ? '700 ' : '') + '12px "Hanken Grotesk", system-ui, sans-serif';
      ctx.fillText(i === vals.length - 1 ? 'Today' : String(Number(labels[i].slice(8))), x + bw / 2, hgt - 8);
    }
  });

  // Budget line
  ctx.setLineDash([6, 4]); ctx.strokeStyle = '#8F5F00'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad.l, y(DAILY_BUDGET)); ctx.lineTo(w - pad.r, y(DAILY_BUDGET)); ctx.stroke();
  ctx.setLineDash([]);
  // Key for the dashed line, above the plot so it never covers a bar
  ctx.setLineDash([6, 4]); ctx.strokeStyle = '#8F5F00'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad.l, 9); ctx.lineTo(pad.l + 26, 9); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '600 12px "Hanken Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#8F5F00'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`Daily budget, ${DAILY_BUDGET} kg`, pad.l + 34, 9);
}

function barIndexAt(evt) {
  if (!barGeom) return -1;
  const rect = bars.getBoundingClientRect();
  const i = Math.floor((evt.clientX - rect.left - barGeom.padL) / barGeom.slot);
  return i >= 0 && i < barGeom.count ? i : -1;
}
function showBar(i) {
  barHover = i;
  drawBars();
  const readout = $('#bars-readout');
  if (i < 0 || !analysis) { readout.textContent = 'Hover or tap a bar to see that day. Dark bars stayed within budget, amber bars went over.'; return; }
  const v = analysis.byDay[i];
  readout.textContent = `${niceDate(dayLabels()[i], true)}: ${fmt(v)} kg CO₂e, ` + (v === 0 ? 'nothing logged.' : v > DAILY_BUDGET ? `${fmt(v - DAILY_BUDGET)} kg over budget.` : 'within budget.');
}
bars.addEventListener('pointermove', (e) => showBar(barIndexAt(e)));
bars.addEventListener('pointerdown', (e) => showBar(barIndexAt(e)));
bars.addEventListener('pointerleave', () => showBar(-1));

function drawAll(animate) {
  if (!analysis) return;
  if (animate && !donutShown && !reduceMotion()) {
    donutShown = true;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / 700, 1);
      drawDonut(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  } else {
    donutShown = true;
    drawDonut(1);
  }
  drawBars();
}
if ('ResizeObserver' in window) {
  const ro = new ResizeObserver(() => drawAll(false));
  ro.observe(donut); ro.observe(bars);
} else {
  window.addEventListener('resize', () => drawAll(false));
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => drawAll(false));

/* =====================================================================
   Drag and Drop API: pledges
   ===================================================================== */
let dragging = null; // { from: 'suggest' | 'pledge', id }
const suggestZone = $('#suggest-zone');
const pledgeZone = $('#pledge-zone');

function dragHandlers(from, id) {
  return {
    draggable: 'true',
    ondragstart: (e) => {
      dragging = { from, id };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', from + ':' + id);
      e.currentTarget.classList.add('is-dragging');
    },
    ondragend: (e) => { dragging = null; e.currentTarget.classList.remove('is-dragging'); suggestZone.classList.remove('drop-active'); pledgeZone.classList.remove('drop-active'); }
  };
}
function wireDropZone(zone, accepts, onDrop) {
  zone.addEventListener('dragover', (e) => {
    if (!dragging || dragging.from !== accepts) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    zone.classList.add('drop-active');
  });
  zone.addEventListener('dragleave', (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drop-active'); });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drop-active');
    if (dragging && dragging.from === accepts) onDrop(dragging.id);
    dragging = null;
  });
}
wireDropZone(pledgeZone, 'suggest', (id) => addPledge(id));
wireDropZone(suggestZone, 'pledge', (id) => removePledge(id));

function addPledge(id) {
  if (state.pledges.some((p) => p.id === id) || !analysis) return;
  const rec = analysis.recs.find((r) => r.id === id);
  if (!rec) return;
  state.pledges.push({ id, title: rec.title, saving: rec.saving });
  save(); renderSuggestions(); renderPledges();
  toast('Pledged: ' + rec.title);
}
function removePledge(id) {
  const p = state.pledges.find((x) => x.id === id);
  state.pledges = state.pledges.filter((x) => x.id !== id);
  save(); renderSuggestions(); renderPledges();
  if (p) toast('Removed from pledges.');
}

function renderSuggestions() {
  const list = $('#suggest-list');
  list.replaceChildren();
  const pledged = new Set(state.pledges.map((p) => p.id));
  const recs = (analysis ? analysis.recs : []).filter((r) => !pledged.has(r.id));
  $('#suggest-title').textContent = recs.length ? `The ${recs.length === 1 ? 'change' : recs.length + ' changes'} that would cut the most` : 'Changes that would cut the most';

  if (!recs.length) {
    list.append(h('li', { class: 'py-6 text-ink/80' }, state.pledges.length
      ? 'You have pledged every suggested change. Keep logging to see new ideas.'
      : 'Log a few days of travel, electricity and meals and the biggest savings will appear here.'));
    return;
  }
  recs.forEach((r, i) => {
    list.append(h('li', Object.assign({ class: 'grid grid-cols-[2rem_1fr] gap-x-4 py-6 sm:grid-cols-[3rem_1fr_7rem]', title: 'Drag to your pledges' }, dragHandlers('suggest', r.id)),
      h('span', { class: 'col-start-1 row-start-1 font-display text-3xl text-spruce/50' }, String(i + 1)),
      h('div', { class: 'col-start-2 row-start-1' },
        h('h4', { class: 'text-lg font-bold' }, r.title),
        h('p', { class: 'mt-1 text-ink/80' }, r.detail),
        h('button', { type: 'button', class: 'mt-3 rounded-md border border-spruce px-3 py-1.5 text-sm font-semibold text-spruce transition-colors hover:bg-spruce hover:text-white', onclick: () => addPledge(r.id) },
          'Pledge this', h('span', { class: 'sr-only' }, ': ' + r.title))),
      h('p', { class: 'col-start-2 row-start-2 mt-3 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:text-right' },
        h('span', { class: 'block text-lg font-bold text-leaf' }, '−' + fmt(r.saving) + ' kg'),
        h('span', { class: 'text-sm text-ink/70' }, 'per month'))));
  });
}

function renderPledges() {
  const list = $('#pledge-list');
  list.replaceChildren();
  state.pledges.forEach((p) => {
    list.append(h('li', Object.assign({ class: 'flex items-start justify-between gap-3 border-b border-ink/15 py-3', title: 'Drag back to remove' }, dragHandlers('pledge', p.id)),
      h('div', {}, h('p', { class: 'font-semibold' }, p.title), h('p', { class: 'text-sm font-bold text-leaf' }, '−' + fmt(p.saving) + ' kg a month')),
      h('button', { type: 'button', class: 'shrink-0 rounded px-2 py-1 text-sm font-semibold text-red-700 hover:bg-sage', onclick: () => removePledge(p.id) }, 'Remove', h('span', { class: 'sr-only' }, ': ' + p.title))));
  });
  $('#pledge-empty').classList.toggle('hidden', state.pledges.length > 0);
  const totalBox = $('#pledge-total');
  totalBox.classList.toggle('hidden', state.pledges.length === 0);
  const sum = state.pledges.reduce((s, p) => s + p.saving, 0);
  $('#pledge-kg').textContent = fmt(sum);
  const month = analysis ? analysis.monthTotal : 0;
  $('#pledge-note').textContent = `${fmt(sum * 12)} kg a year` + (month > 0 ? `, ${Math.round((sum / month) * 100)}% of your last 30 days.` : '.');
}

/* =====================================================================
   File API, Blob and URL: export and import
   ===================================================================== */
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvCell = (v) => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);

$('#export-csv').addEventListener('click', () => {
  if (!state.entries.length) { toast('There is nothing to download yet.'); return; }
  const rows = [...state.entries].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts);
  const csv = ['date,category,activity,amount,unit,kg_co2e'].concat(rows.map((e) => [e.date, CAT_NAME[e.cat], e.label, e.amount, e.unit, e.kg].map(csvCell).join(','))).join('\r\n');
  download(`carbon-log-${todayStr()}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8');
  toast('CSV downloaded.');
});
$('#export-json').addEventListener('click', () => {
  const data = { app: 'carbonfootprint-india', version: 1, exportedAt: new Date().toISOString(), entries: state.entries, pledges: state.pledges };
  download(`carbon-backup-${todayStr()}.json`, JSON.stringify(data, null, 2), 'application/json');
  toast('Backup downloaded.');
});

const importStatus = $('#import-status');
function importFile(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { importStatus.textContent = 'That file is larger than 2 MB. Choose a JSON backup downloaded from this page.'; return; }
  const reader = new FileReader();
  reader.onerror = () => { importStatus.textContent = 'The file could not be read. Try again.'; };
  reader.onload = () => {
    let data;
    try { data = JSON.parse(String(reader.result)); }
    catch { importStatus.textContent = 'That file is not valid JSON. Choose a backup downloaded from this page.'; return; }
    if (!data || !Array.isArray(data.entries)) { importStatus.textContent = 'That file does not look like a CarbonFootprint backup.'; return; }
    const known = new Set(state.entries.map((e) => e.id));
    let added = 0;
    data.entries.slice(0, 5000).forEach((raw) => {
      const e = cleanEntry(raw);
      if (e && !known.has(e.id)) { state.entries.push(e); known.add(e.id); added++; }
    });
    const skipped = Math.min(data.entries.length, 5000) - added;
    if (Array.isArray(data.pledges)) {
      data.pledges.map(cleanPledge).filter(Boolean).forEach((p) => { if (!state.pledges.some((x) => x.id === p.id)) state.pledges.push(p); });
    }
    commit();
    importStatus.textContent = `Imported ${added} ${added === 1 ? 'entry' : 'entries'}.` + (skipped > 0 ? ` Skipped ${skipped} that were duplicates or not valid.` : '');
  };
  reader.readAsText(file);
}
$('#import-file').addEventListener('change', (e) => { importFile(e.target.files[0]); e.target.value = ''; });

const dropzone = $('#dropzone');
['dragenter', 'dragover'].forEach((type) => dropzone.addEventListener(type, (e) => {
  if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
  e.preventDefault(); dropzone.classList.add('drop-active');
}));
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drop-active'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault(); dropzone.classList.remove('drop-active');
  importFile(e.dataTransfer.files[0]);
});
// A file dropped outside the zone should not make the browser navigate away
['dragover', 'drop'].forEach((type) => window.addEventListener(type, (e) => {
  if (e.dataTransfer && [...e.dataTransfer.types].includes('Files') && !e.target.closest('#dropzone')) e.preventDefault();
}));

// Clear everything through a native <dialog>
const confirmDialog = $('#confirm-dialog');
$('#clear-all').addEventListener('click', () => {
  if (typeof confirmDialog.showModal === 'function') confirmDialog.showModal();
  else if (window.confirm('Clear all data from this browser?')) clearAll();
});
confirmDialog.addEventListener('close', () => { if (confirmDialog.returnValue === 'confirm') clearAll(); confirmDialog.returnValue = ''; });
function clearAll() {
  state.entries = []; state.pledges = [];
  commit();
  toast('All data cleared.');
}

/* =====================================================================
   Web Share and Clipboard APIs
   ===================================================================== */
$('#share-button').addEventListener('click', async () => {
  if (!analysis || analysis.monthTotal <= 0) { toast('Log a few activities first, then share your summary.'); return; }
  const total = analysis.monthTotal;
  const annualT = (total / 30) * 365 / 1000;
  let text = `In the last 30 days I logged ${fmt(total)} kg CO₂e`;
  if (analysis.prevTotal > 0) text += `, ${Math.round((Math.abs(total - analysis.prevTotal) / analysis.prevTotal) * 100)}% ${total <= analysis.prevTotal ? 'lower' : 'higher'} than the 30 days before`;
  text += `. At this pace that is ${fmtT(annualT)} t a year, against a 2.3 t target. Tracked with CarbonFootprint India.`;
  const data = { title: 'My carbon footprint', text };
  const box = $('#share-box');
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      await navigator.share(data);
      return;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return; // the person closed the share sheet
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Summary copied. Paste it wherever you like.');
    box.classList.add('hidden');
  } catch {
    box.value = text;
    box.classList.remove('hidden');
    box.focus(); box.select();
  }
});

/* =====================================================================
   Live feature check for the "HTML5 APIs" table
   ===================================================================== */
const CHECKS = {
  storage: () => { try { localStorage.setItem('__cfi', '1'); localStorage.removeItem('__cfi'); return 'sessionStorage' in window; } catch { return false; } },
  geolocation: () => 'geolocation' in navigator,
  canvas: () => !!document.createElement('canvas').getContext,
  dnd: () => 'draggable' in document.createElement('span') && 'ondrop' in document.createElement('div'),
  worker: () => typeof Worker === 'function',
  notifications: () => 'Notification' in window,
  file: () => 'FileReader' in window && 'Blob' in window && !!(window.URL && URL.createObjectURL),
  share: () => (navigator.share ? true : navigator.clipboard ? 'partial' : false),
  validation: () => { const i = document.createElement('input'); return 'checkValidity' in i && 'setCustomValidity' in i && 'validity' in i; },
  observer: () => 'IntersectionObserver' in window
};
const NOTES = {
  storage: () => storageOK ? 'Data is being saved.' : 'Saving is blocked in this browser.',
  geolocation: () => window.isSecureContext ? 'Asks permission when you start a trip.' : 'Needs https or localhost. Use the demo walk here.',
  worker: () => analysisMode === 'worker' ? 'Running the analysis now.' : analysisMode === 'main' ? 'Not running here. Using the main thread.' : '',
  notifications: () => notifSupported() ? 'Permission: ' + Notification.permission + '.' : '',
  share: (res) => res === 'partial' ? 'No share sheet here. Falls back to copying.' : res === true ? 'Share sheet available.' : '',
  dnd: () => 'Touch screens use the Pledge buttons.'
};
function refreshApiTable() {
  document.querySelectorAll('[data-api]').forEach((row) => {
    const key = row.dataset.api;
    let res = false;
    try { res = CHECKS[key](); } catch { res = false; }
    const badge = row.querySelector('[data-support]');
    badge.textContent = res === true ? 'Supported' : res === 'partial' ? 'Partly supported' : 'Not supported';
    badge.className = 'font-semibold ' + (res === true ? 'text-leaf' : res === 'partial' ? 'text-marigold-deep' : 'text-red-700');
    row.querySelector('[data-note]').textContent = NOTES[key] ? NOTES[key](res) : '';
  });
}

/* =====================================================================
   Start-up
   ===================================================================== */
function commit() { save(); refreshAll(); }
function refreshAll() {
  renderReceipt();
  renderLog();
  renderPledges();
  runAnalysis(); // charts, stats and suggestions follow in onAnalysis()
}

fillOptions('travel');
restoreDraft();
dateInput.value = todayStr();
validateDate();
update();
setupWorker();
updateReminderUI();
refreshApiTable();
refreshAll();
setInterval(() => { if (toStr(new Date()) !== $('#receipt-date').getAttribute('datetime')) { dateInput.value = todayStr(); validateDate(); refreshAll(); } }, 60000);

/* =====================================================================
   EVENT HANDLING
   focus, blur, keydown, scroll, mouseover, mouseout, dblclick,
   online, offline, visibilitychange, beforeunload
   ===================================================================== */

/* ---- Live event monitor (shows every event listed in the Events section) ---- */
const eventLog = [];
const lastLogged = {};
function logEvent(type, target, note, throttleMs = 0) {
  const now = Date.now();
  if (throttleMs && now - (lastLogged[type] || 0) < throttleMs) return;
  lastLogged[type] = now;
  eventLog.unshift({ type, target, note, time: new Date().toLocaleTimeString('en-IN') });
  eventLog.length = Math.min(eventLog.length, 8);
  const list = $('#event-log');
  list.replaceChildren();
  eventLog.forEach((ev) => list.append(h('li', {},
    h('span', { class: 'text-white/60' }, ev.time + ' '),
    h('strong', { class: 'text-marigold' }, ev.type), ' ',
    h('span', { class: 'text-white/70' }, ev.target + ': '), ev.note)));
}

/* ---- focus and blur: field hints, select-on-focus, tidy-on-blur ---- */
const fieldHint = $('#field-hint');
const HINTS = {
  amount: 'Type a number. Decimals are fine, for example 12.5. Press Ctrl+Enter to add.',
  'entry-date': 'Pick the day this happened. Future dates are not allowed.',
  kind: 'Use the arrow keys to change the activity. The estimate updates instantly.'
};
[amountInput, dateInput, kindSelect].forEach((el) => {
  el.addEventListener('focus', () => {
    fieldHint.textContent = HINTS[el.id];
    if (el === amountInput) el.select();
    logEvent('focus', '#' + el.id, 'Hint shown');
  });
  el.addEventListener('blur', () => {
    fieldHint.textContent = '';
    if (el === amountInput) {
      const v = parseFloat(el.value);
      if (!Number.isNaN(v)) el.value = String(Math.round(v * 100) / 100);
      update(); saveDraft();
    }
    if (el === dateInput) validateDate();
    logEvent('blur', '#' + el.id, el === amountInput ? 'Amount tidied and checked' : 'Field checked');
  });
});

/* ---- keydown: keyboard shortcuts ---- */
document.addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && form.contains(e.target)) {
    e.preventDefault();
    form.requestSubmit();
    logEvent('keydown', 'Ctrl+Enter', 'Entry submitted');
  } else if (e.altKey && /^Digit[1-4]$/.test(e.code)) {
    e.preventDefault();
    const key = CAT_ORDER[Number(e.code.slice(5)) - 1];
    const radio = document.getElementById('cat-' + key);
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    logEvent('keydown', 'Alt+' + e.code.slice(5), 'Category: ' + CAT_NAME[key]);
  } else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    amountInput.focus();
    form.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
    logEvent('keydown', '/', 'Jumped to amount');
  }
});

/* ---- scroll: progress bar and back-to-top button ---- */
const progressBar = $('#scroll-progress');
const toTop = $('#to-top');
let scrollTicking = false;
window.addEventListener('scroll', () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
    progressBar.style.width = pct + '%';
    toTop.classList.toggle('hidden', window.scrollY < 600);
    logEvent('scroll', 'window', Math.round(pct) + '% of the page', 800);
    scrollTicking = false;
  });
}, { passive: true });
toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }));

/* ---- mouseover / mouseout: highlight a category in the donut ---- */
function highlightCategory(key, type) {
  if (donutHi === key) return;
  donutHi = key;
  drawDonut(1);
  if (key) logEvent(type, '#cat-list', 'Highlighted ' + CAT_NAME[key], 300);
}
const catListEl = $('#cat-list');
catListEl.addEventListener('mouseover', (e) => {
  const li = e.target.closest('li[data-cat]');
  if (li) highlightCategory(li.dataset.cat, 'mouseover');
});
catListEl.addEventListener('mouseout', (e) => {
  const li = e.target.closest('li[data-cat]');
  if (li && !li.contains(e.relatedTarget)) highlightCategory(null, 'mouseout');
});
catListEl.addEventListener('focusin', (e) => {
  const li = e.target.closest('li[data-cat]');
  if (li) highlightCategory(li.dataset.cat, 'focus');
});
catListEl.addEventListener('focusout', () => highlightCategory(null, 'blur'));

/* ---- dblclick: repeat a logged activity for today ---- */
$('#log-body').addEventListener('dblclick', (e) => {
  const row = e.target.closest('tr[data-id]');
  if (!row || e.target.closest('button')) return;
  const original = state.entries.find((x) => x.id === row.dataset.id);
  if (!original) return;
  const copy = makeEntry(todayStr(), original.kind, original.amount, false);
  state.entries.push(copy);
  commit();
  toast(`Logged again for today: ${copy.label}, ${amountText(copy.amount, copy.unit)}.`);
  logEvent('dblclick', 'log row', 'Repeated ' + copy.label);
});

/* ---- online / offline: connection status ---- */
window.addEventListener('offline', () => {
  toast('You are offline. Logging still works and saves in this browser.');
  logEvent('offline', 'window', 'Connection lost');
});
window.addEventListener('online', () => {
  toast('Back online.');
  logEvent('online', 'window', 'Connection restored');
});

/* ---- visibilitychange and beforeunload ---- */
document.addEventListener('visibilitychange', () => {
  logEvent('visibilitychange', 'document', document.visibilityState);
  if (document.visibilityState !== 'visible') return;
  checkReminder();
  if (toStr(new Date()) !== $('#receipt-date').getAttribute('datetime')) { dateInput.value = todayStr(); validateDate(); refreshAll(); }
});
window.addEventListener('beforeunload', (e) => {
  if (trip.active) { e.preventDefault(); e.returnValue = ''; } // a GPS trip is still running
});

/* ---- Existing events, also shown in the monitor ---- */
amountInput.addEventListener('input', () => logEvent('input', '#amount', 'Estimate recalculated', 400));
kindSelect.addEventListener('change', () => logEvent('change', '#kind', 'Activity changed'));
form.addEventListener('submit', () => logEvent('submit', '#estimator', 'Form submitted'));
pledgeZone.addEventListener('drop', () => logEvent('drop', '#pledge-zone', 'Pledge dropped'));
bars.addEventListener('pointermove', () => logEvent('pointermove', '#bars', 'Bar inspected', 600));
