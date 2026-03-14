/**
 * PIX Payment Page - Animacase
 * Exibe QR Code e código copia e cola. Integração Utmify via pix-payment.html.
 * Polling opcional se API_BASE e transactionId existirem; "Já paguei" redireciona para aprovado.
 */
(function () {
  const STORAGE_QRCODE = 'animacase_pix_qrcode';
  const STORAGE_AMOUNT = 'animacase_pix_amount';
  const STORAGE_TRANSACTION_ID = 'animacase_pix_transaction_id';
  const STORAGE_EMAIL = 'animacase_pix_email';
  const POLL_INTERVAL_MS = 5000;
  const QR_API = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=';

  function getParam(name) {
    var params = window.location.search ? new URLSearchParams(window.location.search) : null;
    return params ? params.get(name) : null;
  }

  function formatPrice(n) {
    return 'R$ ' + Number(n).toFixed(2).replace('.', ',');
  }

  function redirectToApproved(email) {
    var url = 'checkout-pix-aprovado.html';
    if (email) url += '?email=' + encodeURIComponent(email);
    window.location.href = url;
  }

  function startStatusPolling(transactionId, email) {
    if (!transactionId) return;
    var apiBase = (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE : '';
    if (!apiBase) return;
    var pollTimer = setInterval(function () {
      fetch(apiBase + '/api/pix-status/' + encodeURIComponent(transactionId))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.status === 'paid') {
            clearInterval(pollTimer);
            redirectToApproved(email);
          }
        })
        .catch(function () {});
    }, POLL_INTERVAL_MS);
  }

  function init() {
    var totalParam = getParam('total');
    var amountEl = document.getElementById('pix-amount');
    var qrEl = document.getElementById('pix-qr');
    var codeEl = document.getElementById('pix-code');
    var copyBtn = document.getElementById('pix-copy-btn');
    var copyTextEl = copyBtn ? copyBtn.querySelector('.pix__copy-text') : null;
    var jaPagueiBtn = document.getElementById('pix-ja-paguei-btn');

    var pixCode = '';
    var amount = 0;

    try {
      pixCode = sessionStorage.getItem(STORAGE_QRCODE) || '';
      var storedAmount = sessionStorage.getItem(STORAGE_AMOUNT);
      amount = storedAmount ? parseFloat(String(storedAmount).replace(',', '.')) || 0 : 0;
    } catch (_) {}

    if (totalParam && !amount) {
      amount = parseFloat(String(totalParam).replace(',', '.')) || 0;
    }

    var displayAmount = amount > 0 ? amount : 0;
    if (amountEl) amountEl.textContent = formatPrice(displayAmount);

    if (!pixCode && displayAmount > 0) {
      var qrSection = document.querySelector('.pix__qr-section');
      if (qrSection) {
        qrSection.insertAdjacentHTML('beforebegin',
          '<p class="pix__error">Acesse esta página pelo checkout para gerar o PIX.</p>'
        );
      }
      if (qrEl) qrEl.style.display = 'none';
      if (codeEl) codeEl.value = '';
      if (copyBtn) copyBtn.disabled = true;
      if (jaPagueiBtn) jaPagueiBtn.style.display = 'none';
    } else {
      if (codeEl) codeEl.value = pixCode;
      if (pixCode && qrEl) {
        qrEl.src = QR_API + encodeURIComponent(pixCode);
        qrEl.style.display = '';
      }
      if (copyBtn) {
        copyBtn.disabled = !pixCode;
        copyBtn.addEventListener('click', function () {
          if (!codeEl || !pixCode) return;
          codeEl.select();
          codeEl.setSelectionRange(0, 99999);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(codeEl.value).then(function () {
              copyBtn.classList.add('copied');
              if (copyTextEl) copyTextEl.textContent = 'Copiado!';
              setTimeout(function () {
                copyBtn.classList.remove('copied');
                if (copyTextEl) copyTextEl.textContent = 'Copiar código';
              }, 2000);
            });
          }
        });
      }
    }

    if (jaPagueiBtn) {
      jaPagueiBtn.addEventListener('click', function () {
        var email = '';
        try { email = sessionStorage.getItem(STORAGE_EMAIL) || ''; } catch (_) {}
        redirectToApproved(email);
      });
    }

    try {
      var txId = sessionStorage.getItem(STORAGE_TRANSACTION_ID) || '';
      var email = sessionStorage.getItem(STORAGE_EMAIL) || '';
      startStatusPolling(txId, email);
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
