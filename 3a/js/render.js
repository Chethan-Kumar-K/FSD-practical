'use strict';

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
let logQuery = '';
function renderLog() {
  const body = $('#log-body');
  body.replaceChildren();
  let rows = [...state.entries].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  const q = logQuery.trim().toLowerCase();
  if (q) rows = rows.filter((e) => (e.label + ' ' + CAT_NAME[e.cat]).toLowerCase().includes(q));
  const shown = showAllRows || q ? rows : rows.slice(0, 8);

  if (!rows.length && q) body.append(h('tr', {}, h('td', { colspan: '5', class: 'px-4 py-8 text-center text-ink/70' }, 'No entries match “' + logQuery.trim() + '”.')));
  if (!rows.length && !q) {
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
  more.classList.toggle('hidden', rows.length <= 8 || !!q);
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
const dayLabels = () => Array.from({ length: barRange }, (_, i) => shiftDate(analysis ? analysis.today : todayStr(), i - (barRange - 1)));

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
  ctx.strokeStyle = chartVar('--chart-track');
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
  ctx.fillStyle = chartVar('--chart-ink');
  ctx.font = `${Math.round(R * 0.3)}px "Young Serif", Georgia, serif`;
  ctx.globalAlpha = 1;
  ctx.fillText(fmt(donutHi ? analysis.cats[donutHi] : total), cx, cy - R * 0.06);
  ctx.fillStyle = chartVar('--chart-text');
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
    ctx.strokeStyle = chartVar('--chart-grid');
    ctx.beginPath(); ctx.moveTo(pad.l, y(tick) + 0.5); ctx.lineTo(w - pad.r, y(tick) + 0.5); ctx.stroke();
    ctx.fillStyle = chartVar('--chart-text');
    ctx.fillText(String(tick), pad.l - 6, y(tick));
  });

  const labels = dayLabels();
  vals.forEach((v, i) => {
    const x = pad.l + slot * i + (slot - bw) / 2;
    const top = y(v);
    ctx.fillStyle = v > DAILY_BUDGET ? '#C77F00' : chartVar('--chart-ink');
    if (v > 0) ctx.fillRect(x, top, bw, y(0) - top);
    if (i === barHover) { ctx.strokeStyle = chartVar('--chart-ink'); ctx.lineWidth = 2; ctx.strokeRect(x - 2, Math.min(top, y(0) - 2) - 2, bw + 4, Math.max(y(0) - top, 2) + 4); ctx.lineWidth = 1; }
    // x labels: day of the month, every second one on narrow screens
    if (slot >= 24 || i % 2 === vals.length % 2) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = i === vals.length - 1 ? chartVar('--chart-ink') : chartVar('--chart-text');
      ctx.font = (i === vals.length - 1 ? '700 ' : '') + '12px "Hanken Grotesk", system-ui, sans-serif';
      ctx.fillText(i === vals.length - 1 ? 'Today' : String(Number(labels[i].slice(8))), x + bw / 2, hgt - 8);
    }
  });

  // Budget line
  ctx.setLineDash([6, 4]); ctx.strokeStyle = chartVar('--chart-budget'); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad.l, y(DAILY_BUDGET)); ctx.lineTo(w - pad.r, y(DAILY_BUDGET)); ctx.stroke();
  ctx.setLineDash([]);
  // Key for the dashed line, above the plot so it never covers a bar
  ctx.setLineDash([6, 4]); ctx.strokeStyle = chartVar('--chart-budget'); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad.l, 9); ctx.lineTo(pad.l + 26, 9); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '600 12px "Hanken Grotesk", system-ui, sans-serif';
  ctx.fillStyle = chartVar('--chart-budget'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
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

