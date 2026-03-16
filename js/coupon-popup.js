/**
 * Popup de cupom 20% PIX (NOPIX) - aparece 3s após o carregamento, uma única vez por lead
 * Kirkland Original
 */
(function () {
  var STORAGE_KEY = 'kirkland_coupon_popup_seen';
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
  } catch (e) {}

  var path = (window.location.pathname || '').replace(/\/$/, '') || '/';
  var isHome = path === '' || path === '/' || path === '/index.html' || /\/index\.html$/.test(path);
  if (!isHome) return;
  if (path.indexOf('checkout') !== -1 || path.indexOf('mercado-pago') !== -1 || path.indexOf('checkout-pix') !== -1 || path.indexOf('checkout-boleto') !== -1) {
    return;
  }

  var logoUrl = 'images/logo-kirkland-signature.png';
  var COUPON_CODE = 'NOPIX';

  var overlay = document.createElement('div');
  overlay.className = 'coupon-popup-overlay';
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'coupon-popup-title');
  overlay.setAttribute('role', 'dialog');
  overlay.dataset.screen = 'offer';

  overlay.innerHTML =
    '<div class="coupon-popup">' +
      '<div class="coupon-popup__logo-wrap">' +
        '<button type="button" class="coupon-popup__close" id="coupon-popup-close" aria-label="Fechar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 17" width="20" height="20" aria-hidden="true"><path d="M.865 15.978a.5.5 0 00.707.707l7.433-7.431 7.579 7.282a.501.501 0 00.846-.37.5.5 0 00-.153-.351L9.712 8.546l7.417-7.416a.5.5 0 10-.707-.708L8.991 7.853 1.413.573a.5.5 0 10-.693.72l7.563 7.268-7.418 7.417z" fill="currentColor"/></svg></button>' +
        '<img src="' + logoUrl + '" alt="Kirkland Original" class="coupon-popup__logo" width="160" height="45">' +
      '</div>' +
      '<div class="coupon-popup__body">' +
        '<div class="coupon-popup__screen-offer">' +
          '<h2 class="coupon-popup__title" id="coupon-popup-title">Parabéns! Você ganhou 20% de desconto no PIX para iniciar seu tratamento.</h2>' +
          '<div class="coupon-popup__actions">' +
            '<button type="button" class="coupon-popup__btn coupon-popup__btn--primary" id="coupon-popup-resgatar">Resgatar Cupom</button>' +
            '<button type="button" class="coupon-popup__btn coupon-popup__btn--secondary" id="coupon-popup-rejeitar">Não, obrigado</button>' +
          '</div>' +
        '</div>' +
        '<div class="coupon-popup__screen-coupon">' +
          '<h2 class="coupon-popup__title">Seu cupom de 20%:</h2>' +
          '<p class="coupon-popup__disclaimer">⏱️ Este cupom expira em 1 hora. Use no checkout ao pagar com PIX e garanta seu 20% de desconto antes que o prazo acabe.</p>' +
          '<div class="coupon-popup__code-wrap">' +
            '<p class="coupon-popup__code-label">Código do cupom</p>' +
            '<p class="coupon-popup__code">' + COUPON_CODE + '</p>' +
          '</div>' +
          '<button type="button" class="coupon-popup__btn coupon-popup__btn--primary" id="coupon-popup-copiar">Copiar Cupom</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  function show() {
    overlay.classList.add('is-visible');
  }

  function hide() {
    overlay.classList.remove('is-visible');
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (e) {}
  }

  function goToCouponScreen() {
    overlay.dataset.screen = 'coupon';
  }

  function copyCoupon() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(COUPON_CODE).then(function () {
        hide();
      }).catch(function () {
        fallbackCopy();
      });
    } else {
      fallbackCopy();
    }
    function fallbackCopy() {
      var ta = document.createElement('textarea');
      ta.value = COUPON_CODE;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        hide();
      } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  document.getElementById('coupon-popup-close').addEventListener('click', hide);
  document.getElementById('coupon-popup-resgatar').addEventListener('click', goToCouponScreen);
  document.getElementById('coupon-popup-rejeitar').addEventListener('click', hide);
  document.getElementById('coupon-popup-copiar').addEventListener('click', copyCoupon);

  setTimeout(show, 3000);
})();
