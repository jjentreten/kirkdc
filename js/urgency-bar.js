/**
 * Barra de urgência: countdown e fallback "Últimas unidades disponíveis" ao chegar em 00:00
 */
(function () {
  var bar = document.getElementById('urgency-bar');
  var timerEl = document.getElementById('urgency-bar-timer');
  if (!bar || !timerEl) return;

  var totalSeconds = 14 * 60 + 59; // 14:59
  var storageKey = 'urgency_bar_end_at';

  function getEndTime() {
    try {
      var saved = sessionStorage.getItem(storageKey);
      if (saved) {
        var t = parseInt(saved, 10);
        if (!isNaN(t)) return t;
      }
    } catch (e) {}
    return Date.now() + totalSeconds * 1000;
  }

  function setEndTime(ms) {
    try {
      sessionStorage.setItem(storageKey, String(ms));
    } catch (e) {}
  }

  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function showEnded() {
    bar.classList.add('is-ended');
    var text = bar.querySelector('.urgency-bar__text');
    if (text) text.textContent = '\uD83C\uDF89 \u00DAltimas unidades dispon\u00EDveis';
  }

  var endAt = getEndTime();
  if (endAt <= Date.now()) {
    showEnded();
    return;
  }
  setEndTime(endAt);

  function tick() {
    var now = Date.now();
    var left = Math.max(0, Math.ceil((endAt - now) / 1000));
    if (left <= 0) {
      showEnded();
      if (window.clearInterval) clearInterval(interval);
      return;
    }
    timerEl.textContent = formatTime(left);
  }

  tick();
  var interval = window.setInterval(tick, 1000);
})();
