'use strict';

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

