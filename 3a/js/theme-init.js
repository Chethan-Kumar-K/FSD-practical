/* Runs before first paint so the saved theme never flashes */
try {
  var t = localStorage.getItem('cfi.theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
} catch (e) { /* storage blocked */ }
