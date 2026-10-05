'use strict';

/* =====================================================================
   EVENT HANDLING
   focus, blur, keydown, scroll, mouseover, mouseout, dblclick,
   online, offline, visibilitychange, beforeunload
   ===================================================================== */

/* ---- Event logger: prints to the browser console (F12), nothing is shown on the page ---- */
const lastLogged = {};
function logEvent(type, target, note, throttleMs = 0) {
  const now = Date.now();
  if (throttleMs && now - (lastLogged[type] || 0) < throttleMs) return;
  lastLogged[type] = now;
  console.log('%c[event]%c ' + type + ' on ' + target + ': ' + note, 'color:#F2A900;font-weight:bold', 'color:inherit');
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


/* =====================================================================
   MORE EVENTS
   keyup, paste, copy, contextmenu, mousemove, mouseleave, resize,
   hashchange, toggle, DOMContentLoaded
   ===================================================================== */

/* ---- keyup: filter the log as you type (Esc clears) ---- */
const logFilter = $('#log-filter');
logFilter.addEventListener('keyup', (e) => {
  if (e.key === 'Escape') logFilter.value = '';
  if (logFilter.value === logQuery) return;
  logQuery = logFilter.value;
  renderLog();
  logEvent('keyup', '#log-filter', 'Filter: "' + logQuery + '"', 300);
});

/* ---- paste: pull the number out of text such as "12 km" ---- */
amountInput.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text');
  const m = text.replace(/,/g, '').match(/\d+(\.\d+)?/);
  if (!m) { toast('No number found in the pasted text.'); return; }
  amountInput.value = m[0];
  update(); saveDraft();
  toast('Pasted ' + m[0] + ' from "' + text.trim().slice(0, 20) + '".');
  logEvent('paste', '#amount', 'Number extracted: ' + m[0]);
});

/* ---- copy: add a source line when receipt text is copied ---- */
document.querySelector('[aria-labelledby="receipt-title"]').addEventListener('copy', (e) => {
  const selected = String(document.getSelection());
  if (!selected) return;
  e.preventDefault();
  e.clipboardData.setData('text/plain', selected + '\n— CarbonFootprint India, ' + niceDate(todayStr()));
  toast('Receipt text copied with a source line.');
  logEvent('copy', 'receipt', 'Copied with source line');
});

/* ---- contextmenu: right-click a log row ---- */
const ctxMenu = h('div', { role: 'menu', class: 'fixed z-[80] hidden w-48 rounded-md border border-ink/20 bg-white p-1 text-sm shadow-lg' });
document.body.append(ctxMenu);
const hideCtx = () => ctxMenu.classList.add('hidden');
$('#log-body').addEventListener('contextmenu', (e) => {
  const row = e.target.closest('tr[data-id]');
  if (!row) return;
  e.preventDefault();
  const id = row.dataset.id;
  const item = (label, fn) => h('button', { type: 'button', role: 'menuitem', class: 'block w-full rounded px-3 py-2 text-left font-semibold hover:bg-sage', onclick: () => { hideCtx(); fn(); } }, label);
  ctxMenu.replaceChildren(
    item('Log again today', () => {
      const src = state.entries.find((x) => x.id === id);
      if (!src) return;
      state.entries.push(makeEntry(todayStr(), src.kind, src.amount, false));
      commit(); toast('Logged again for today.');
    }),
    item('Remove entry', () => removeEntry(id)));
  ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
  ctxMenu.style.top = Math.min(e.clientY, window.innerHeight - 100) + 'px';
  ctxMenu.classList.remove('hidden');
  ctxMenu.firstChild.focus();
  logEvent('contextmenu', 'log row', 'Custom menu opened');
});
document.addEventListener('click', hideCtx);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideCtx(); });
window.addEventListener('scroll', hideCtx, { passive: true });

/* ---- mousemove / mouseleave: tooltip that follows the cursor over the donut ---- */
const donutTip = h('div', { class: 'pointer-events-none fixed z-[80] hidden rounded bg-ink px-2.5 py-1.5 text-xs font-semibold text-white shadow' });
document.body.append(donutTip);
donut.addEventListener('mousemove', (e) => {
  if (!analysis || analysis.monthTotal <= 0) return;
  const r = donut.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const R = Math.min(r.width, r.height) / 2 - 4, dist = Math.hypot(dx, dy);
  let hit = null;
  if (dist <= R && dist >= R * 0.72) { // only the ring, not the hole
    let ang = Math.atan2(dy, dx) + Math.PI / 2;
    if (ang < 0) ang += Math.PI * 2;
    let acc = 0;
    for (const k of CAT_ORDER) {
      const sweep = (analysis.cats[k] / analysis.monthTotal) * Math.PI * 2;
      if (ang >= acc && ang < acc + sweep) { hit = k; break; }
      acc += sweep;
    }
  }
  if (!hit) { donutTip.classList.add('hidden'); highlightCategory(null, 'mousemove'); return; }
  donutTip.textContent = `${CAT_NAME[hit]}: ${fmt(analysis.cats[hit])} kg (${Math.round((analysis.cats[hit] / analysis.monthTotal) * 100)}%)`;
  donutTip.style.left = Math.min(e.clientX + 14, window.innerWidth - 200) + 'px';
  donutTip.style.top = e.clientY + 14 + 'px';
  donutTip.classList.remove('hidden');
  highlightCategory(hit, 'mousemove');
});
donut.addEventListener('mouseleave', () => { donutTip.classList.add('hidden'); highlightCategory(null, 'mouseleave'); });

/* ---- resize: reset the mobile menu when the window grows to desktop size ---- */
window.addEventListener('resize', () => {
  if (window.matchMedia('(min-width: 1024px)').matches) setMenu(false);
  logEvent('resize', 'window', window.innerWidth + ' x ' + window.innerHeight, 500);
});

/* ---- hashchange: the tab title follows the section ---- */
const SECTION_NAMES = { home: 'Dashboard', activities: 'Log Activity', log: 'My Log', insights: 'Insights', pledges: 'Pledges', about: 'About' };
window.addEventListener('hashchange', () => {
  document.title = 'CarbonFootprint India | ' + (SECTION_NAMES[location.hash.slice(1)] || 'Dashboard');
  logEvent('hashchange', 'window', location.hash || '#');
});

/* ---- toggle: the summary text follows the open state of <details> ---- */
const tableDetails = document.querySelector('#insights details');
tableDetails.addEventListener('toggle', () => {
  tableDetails.querySelector('summary').textContent = tableDetails.open ? 'Hide the table' : 'View the same data as a table';
  logEvent('toggle', 'details', tableDetails.open ? 'opened' : 'closed');
});

/* ---- DOMContentLoaded: welcome message with today's total ---- */
document.addEventListener('DOMContentLoaded', () => {
  const t = sumForDate(todayStr());
  toast(t > 0 ? `Welcome back. Today you are at ${fmt(t)} kg CO₂e.` : 'Welcome. Nothing logged today yet.');
});
