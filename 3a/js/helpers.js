/* =====================================================================
   CarbonFootprint India: script overview

   JavaScript events used (non-click):
     focus, blur           field hints, select-on-focus, tidy amount on blur
     keydown               shortcuts: /  Alt+1-4  Ctrl+Enter  Esc
     keyup                 live filter for the activity log
     input, change         live estimate, category and activity pickers
     submit                add an entry (with validation)
     paste                 pulls the number out of pasted text like "12 km"
     copy                  adds a source line to copied receipt text
     scroll                progress bar and back-to-top button
     resize                resets the mobile menu when the window grows
     hashchange            tab title follows the section you navigate to
     toggle                <details> summary text changes when opened
     mouseover, mouseout   category list highlights the donut slice
     mousemove, mouseleave tooltip that follows the cursor over the donut
     contextmenu           right-click a log row for a custom menu
     dblclick              double-click a log row to repeat it today
     dragstart, dragover, drop   pledges drag and drop, backup file drop
     pointermove           bar chart readout
     online, offline       connection status messages
     visibilitychange      re-check reminders when you return to the tab
     beforeunload          warns before leaving during a GPS trip
     DOMContentLoaded      welcome message with today's total
     storage               keeps several open tabs in sync
     touchstart, touchmove, touchend   swipe a log row left to delete it
     beforeprint, afterprint           print view: all rows, light theme
     change (matchMedia)               follows the system dark-mode setting
     keydown Ctrl+Z                    undo the last removed entry

   HTML5 APIs used: Web Storage, Geolocation, Canvas, Drag and Drop,
   Web Workers, Notifications, File API (Blob + URL), Web Share and
   Clipboard, Constraint Validation, Intersection Observer.
   Open the browser console to see each event printed as "[event]".
   ===================================================================== */

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
  ['home', 'activities', 'log', 'insights', 'pledges'].forEach((id) => spy.observe(document.getElementById(id)));
}
window.addEventListener('scroll', () => {
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) markActive('about');
}, { passive: true });


let barRange = 14; // days shown in the bar chart (14 or 30)
const chartVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
