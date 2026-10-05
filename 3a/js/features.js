/* =====================================================================
   FEATURES: dark mode, goals and streak, animated counters, scroll
   reveal, chart range, swipe to delete, undo, print view
   ===================================================================== */
'use strict';

/* ---- Dark mode (matchMedia change event follows the system setting) ---- */
const root = document.documentElement;
const themeBtn = $('#theme-toggle');
const savedTheme = () => { try { return localStorage.getItem('cfi.theme'); } catch { return null; } };
function applyTheme(dark, persist) {
  root.classList.toggle('dark', dark);
  themeBtn.setAttribute('aria-pressed', String(dark));
  themeBtn.textContent = dark ? '☀ Light' : '☾ Dark';
  if (persist) { try { localStorage.setItem('cfi.theme', dark ? 'dark' : 'light'); } catch { /* blocked */ } }
  drawAll(false);
}
themeBtn.addEventListener('click', () => applyTheme(!root.classList.contains('dark'), true));
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
systemDark.addEventListener('change', (e) => { if (!savedTheme()) applyTheme(e.matches, false); logEvent('change', 'matchMedia', 'System dark mode: ' + e.matches); });
applyTheme(root.classList.contains('dark'), false);

/* ---- Goals and streak ---- */
function renderGoals() {
  const today = todayStr(), per = {};
  state.entries.forEach((e) => { per[e.date] = (per[e.date] || 0) + e.kg; });
  let d = per[today] != null ? today : shiftDate(today, -1), streak = 0;
  while (per[d] != null && per[d] <= DAILY_BUDGET) { streak++; d = shiftDate(d, -1); }
  $('#streak-badge').textContent = streak + '-day streak';
  $('#streak-note').textContent = streak ? 'Days in a row under ' + DAILY_BUDGET + ' kg.' : 'Log a day under budget to start one.';
  let week = 0;
  for (let i = 0; i < 7; i++) { const v = per[shiftDate(today, -i)]; if (v != null && v <= DAILY_BUDGET) week++; }
  $('#goal-week').value = week;
  $('#goal-week-text').textContent = week + ' of 7 days under budget.';
  const cut = analysis.prevTotal > 0 ? Math.max(0, (1 - analysis.monthTotal / analysis.prevTotal) * 100) : 0;
  $('#goal-cut').value = Math.min(100, cut * 10);
  $('#goal-cut-text').textContent = analysis.prevTotal > 0 ? `${Math.round(cut)}% lower so far. Target: 10%.` : 'Needs 60 days of data to compare.';
}

/* ---- Animated counters ---- */
function countUp(el) {
  const final = el.textContent, to = parseFloat(final.replace(/,/g, '')) || 0, from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  cancelAnimationFrame(el._raf);
  if (reduceMotion() || from === to) return;
  const dec = (final.split('.')[1] || '').length, t0 = performance.now();
  const step = (now) => {
    const p = Math.min((now - t0) / 800, 1), eased = 1 - Math.pow(1 - p, 3);
    el.textContent = p < 1 ? (from + (to - from) * eased).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : final;
    if (p < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

/* ---- Hook the extras into the existing render step ---- */
const baseRenderInsights = renderInsights;
renderInsights = function () {
  analysis.byDay14 = analysis.byDay14 || analysis.byDay.slice();
  analysis.byDay = barRange === 30 ? analysis.byDay30 : analysis.byDay14;
  baseRenderInsights();
  renderGoals();
  ['#stat-today', '#stat-month', '#stat-year'].forEach((s) => countUp($(s)));
  delete document.body.dataset.loading; // ends the skeleton shimmer
};

/* ---- Chart upgrade: 14 / 30 day range ---- */
const barsFigure = bars.closest('figure');
const rangeBar = h('div', { class: 'mt-4 flex gap-2', role: 'group', 'aria-label': 'Chart range' },
  [14, 30].map((n) => h('button', { type: 'button', 'data-range': n, 'aria-pressed': String(n === 14), onclick: () => setRange(n),
    class: 'rounded-md border border-spruce px-3 py-1.5 text-sm font-semibold text-spruce aria-pressed:bg-spruce aria-pressed:text-white' }, n + ' days')));
bars.before(rangeBar);
function setRange(n) {
  barRange = n;
  rangeBar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.range) === n)));
  barsFigure.querySelector('figcaption').textContent = `The last ${n} days against your daily budget`;
  if (analysis) { renderInsights(); drawBars(); }
  logEvent('click', 'chart range', n + ' days');
}

/* ---- Scroll reveal (IntersectionObserver + CSS) and container query target ---- */
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.1 });
  document.querySelectorAll('main section:not(#home) > div').forEach((el) => { el.classList.add('reveal'); io.observe(el); });
}
document.querySelector('[aria-labelledby="receipt-title"]').classList.add('cq');
$('#toast').classList.add('animate-fade-up'); // custom Tailwind animation

/* ---- Touch events: swipe a log row left to delete ---- */
let swipe = null;
const logBody = $('#log-body');
logBody.addEventListener('touchstart', (e) => {
  const row = e.target.closest('tr[data-id]');
  swipe = row ? { row, x: e.touches[0].clientX, dx: 0 } : null;
}, { passive: true });
logBody.addEventListener('touchmove', (e) => {
  if (!swipe) return;
  swipe.dx = Math.min(0, e.touches[0].clientX - swipe.x);
  swipe.row.style.transform = `translateX(${swipe.dx}px)`;
  swipe.row.style.opacity = String(1 + swipe.dx / 250);
}, { passive: true });
const endSwipe = () => {
  if (!swipe) return;
  const { row, dx } = swipe; swipe = null;
  row.style.transform = ''; row.style.opacity = '';
  if (dx < -90) { logEvent('touchend', 'log row', 'Swiped to delete'); removeEntry(row.dataset.id); }
};
logBody.addEventListener('touchend', endSwipe);
logBody.addEventListener('touchcancel', () => { if (swipe) { swipe.row.style.transform = ''; swipe.row.style.opacity = ''; swipe = null; } });

/* ---- Undo the last removal (Ctrl+Z) ---- */
let lastRemoved = null;
const baseRemoveEntry = removeEntry;
removeEntry = function (id) {
  lastRemoved = state.entries.find((e) => e.id === id) || null;
  baseRemoveEntry(id);
  if (lastRemoved) toast('Entry removed. Press Ctrl+Z to undo.');
};
document.addEventListener('keydown', (e) => {
  if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') || !lastRemoved || ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  e.preventDefault();
  state.entries.push(lastRemoved); lastRemoved = null;
  commit(); toast('Entry restored.');
  logEvent('keydown', 'Ctrl+Z', 'Undo');
});

/* ---- Print view: beforeprint / afterprint ---- */
let printWasDark = false;
$('#print-report').addEventListener('click', () => window.print());
window.addEventListener('beforeprint', () => {
  printWasDark = root.classList.contains('dark');
  if (printWasDark) applyTheme(false, false);
  showAllRows = true; renderLog(); drawAll(false);
  logEvent('beforeprint', 'window', 'Preparing report');
});
window.addEventListener('afterprint', () => {
  if (printWasDark) applyTheme(true, false);
  showAllRows = false; renderLog();
  logEvent('afterprint', 'window', 'Report closed');
});

if (analysis) renderInsights(); // first render happened before these hooks existed
