'use strict';

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

