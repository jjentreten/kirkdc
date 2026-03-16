/**
 * Timer de 1h no badge do cupom NOPIX nas PDPs
 * Kirkland Original
 */
(function () {
  var KEY = 'pdp_coupon_end';
  var ONE_HOUR_MS = 60 * 60 * 1000;

  var el = document.getElementById('pdp-coupon-timer');
  if (!el) return;

  var end = parseInt(sessionStorage.getItem(KEY), 10);
  if (!end || end <= Date.now()) {
    end = Date.now() + ONE_HOUR_MS;
    sessionStorage.setItem(KEY, String(end));
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function tick() {
    var now = Date.now();
    var left = Math.max(0, Math.floor((end - now) / 1000));
    if (left <= 0) {
      el.textContent = '00:00';
      clearInterval(tid);
      return;
    }
    var m = Math.floor(left / 60);
    var s = left % 60;
    el.textContent = pad(m) + ':' + pad(s);
  }

  tick();
  var tid = setInterval(tick, 1000);
})();
