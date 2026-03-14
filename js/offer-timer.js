/**
 * Cronômetro de oferta – Kirkland Original
 * No checkout: 10 minutos, inicia na primeira vez que o lead abre o checkout.
 * Em outras páginas (se existir .js-offer-timer): 15 minutos, primeira visita.
 */
(function () {
  'use strict';

  var isCheckout = !!document.getElementById('checkout-main');
  var STORAGE_KEY = isCheckout ? 'kirkland_checkout_offer_timer_end' : 'animacase_offer_timer_end';
  var DURATION_MS = isCheckout ? 10 * 60 * 1000 : 15 * 60 * 1000; // checkout: 10 min; resto: 15 min

  function getEndTime() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      var end = parseInt(stored, 10);
      if (end > Date.now()) return end;
    }
    var endTime = Date.now() + DURATION_MS;
    localStorage.setItem(STORAGE_KEY, String(endTime));
    return endTime;
  }

  function formatRemaining(ms) {
    if (ms <= 0) return '00:00';
    var totalSeconds = Math.floor(ms / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return (
      String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
    );
  }

  function updateDisplays(text) {
    var nodes = document.querySelectorAll('.js-offer-timer');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = text;
    }
  }

  function tick() {
    var endTime = getEndTime();
    var remaining = endTime - Date.now();

    if (remaining <= 0) {
      updateDisplays('00:00');
      if (window.animacaseOfferTimerId) {
        clearInterval(window.animacaseOfferTimerId);
        window.animacaseOfferTimerId = null;
      }
      return;
    }

    updateDisplays(formatRemaining(remaining));
  }

  function start() {
    tick();
    if (window.animacaseOfferTimerId) clearInterval(window.animacaseOfferTimerId);
    window.animacaseOfferTimerId = setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
