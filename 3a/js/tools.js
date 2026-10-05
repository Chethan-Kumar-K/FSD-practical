'use strict';

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
  const byDay = new Array(14).fill(0), byDay30 = new Array(30).fill(0);
  let monthTotal = 0, prevTotal = 0, todayTotal = 0;

  for (const e of entries) {
    const age = Math.round((todayT - t(e.date)) / DAY); // 0 = today
    if (age < 0) continue;
    if (age === 0) todayTotal += e.kg;
    if (age < 14) byDay[13 - age] += e.kg;
        if (age < 30) byDay30[29 - age] += e.kg;
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

  return { today, cats, byDay, byDay30, monthTotal, prevTotal, todayTotal, recs: recs.slice(0, 5) };
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

