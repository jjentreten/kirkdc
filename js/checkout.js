/**
 * Checkout - Animacase
 * Usa o mesmo carrinho (animacase_cart), promo leve 2 ganhe 1 / leve 5 ganhe 2.
 * Três etapas: dados pessoais, entrega, pagamento (PIX / cartão).
 */
(function () {
  const STORAGE_KEY = 'animacase_cart';
  const PRICE_SALE = 34.90;
  const PRICE_REGULAR = 47.90;
  const SHIPPING_EXPRESS_PRICE = 19.90;

  const COUPONS = { NOPIX: { actual: 10, display: 10 } };
  const COUPON_PIX_ONLY = 'NOPIX'; // desconto só aplicado no PIX; cartão continua disponível
  var appliedCoupon = null;

  function getCouponByCode(code) {
    if (!code || typeof code !== 'string') return null;
    var upper = code.trim().toUpperCase();
    var c = COUPONS[upper];
    if (!c) return null;
    var data = typeof c === 'object' ? c : { actual: c, display: c };
    return { code: upper, percent: data.actual, displayPercent: data.display };
  }

  function getCouponDiscount(subtotal) {
    var coupon = getCouponByCode(appliedCoupon);
    if (!coupon || subtotal <= 0) return 0;
    return Math.round(subtotal * (coupon.percent / 100) * 100) / 100;
  }

  /** Desconto do cupom só entra no total quando pagamento for PIX (cupom PIX-only). */
  function getEffectiveCouponDiscount(subtotal) {
    if (!appliedCoupon || subtotal <= 0) return 0;
    if (appliedCoupon === COUPON_PIX_ONLY) {
      var pixChecked = document.getElementById('checkout-payment-pix')?.checked;
      if (!pixChecked) return 0;
    }
    return getCouponDiscount(subtotal);
  }

  function getCart() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function parsePrice(val) {
    if (typeof val === 'number') return val;
    const n = String(val || '').replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(n) || PRICE_SALE;
  }

  function formatPrice(n) {
    return 'R$ ' + n.toFixed(2).replace('.', ',');
  }

  function getItemPrice(item) {
    return parsePrice(item?.priceSale) || PRICE_SALE;
  }

  function formatVariantDisplay(variant) {
    if (!variant || typeof variant !== 'string') return '';
    const raw = variant.trim();
    if (!raw) return '';
    const brands = { iphone: 'iPhone', samsung: 'Samsung', motorola: 'Motorola', xiaomi: 'Xiaomi' };
    if (raw.indexOf('-') !== -1) {
      const parts = raw.split('-');
      const brandKey = parts[0] && parts[0].toLowerCase();
      const brandLabel = brands[brandKey] || (parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase());
      const rest = (parts[0] === parts[1] ? parts.slice(2) : parts.slice(1))
        .map(function (w) {
          if (/^\d+$/.test(w)) return w;
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(' ');
      return rest ? (brandLabel + ' ' + rest).trim() : brandLabel;
    }
    return raw;
  }

  function getPromoDiscount(items) {
    const total = items.length;
    if (total < 3) return 0;
    let discount = 0;
    if (total >= 3) discount += getItemPrice(items[2]);
    if (total >= 5) discount += getItemPrice(items[4]);
    return discount;
  }

  function getSubtotal(items) {
    const sum = items.reduce((acc, i) => acc + getItemPrice(i), 0);
    return sum - getPromoDiscount(items);
  }

  function escapeAttr(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function renderSummary(items) {
    const container = document.getElementById('checkout-items');
    const discountRow = document.getElementById('checkout-discount-row');
    const discountVal = document.getElementById('checkout-discount-value');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const subtotalLabel = document.getElementById('checkout-subtotal-label');
    const totalEl = document.getElementById('checkout-total');
    const savingsRow = document.getElementById('checkout-savings-row');
    const savingsVal = document.getElementById('checkout-savings-value');

    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = '<p class="checkout-summary__empty">Seu carrinho está vazio. <a href="index.html">Continuar comprando</a></p>';
      if (subtotalEl) subtotalEl.textContent = 'R$ 0,00';
      if (totalEl) totalEl.textContent = 'R$ 0,00';
      if (discountRow) discountRow.style.display = 'none';
      if (savingsRow) savingsRow.style.display = 'none';
      return;
    }

    const promoDiscount = getPromoDiscount(items);
    const subtotal = getSubtotal(items);
    const couponDiscount = getEffectiveCouponDiscount(subtotal);
    const totalDiscount = promoDiscount + couponDiscount;
    const totalAfterDiscount = subtotal - couponDiscount;

    const html = items.map((item, i) => {
      const isFree = i === 2 || i === 4;
      const variantLine = ''; /* Modelo/variant oculto */
      const priceSale = getItemPrice(item);
      const priceRegular = parsePrice(item.priceRegular);
      const singlePrice = priceSale === priceRegular;
      const priceHtml = isFree
        ? '<span class="checkout-summary__item-free">Grátis</span>'
        : singlePrice
          ? formatPrice(priceSale)
          : '<span>' + formatPrice(priceSale) + '</span> <s>' + formatPrice(priceRegular) + '</s>';
      return (
        '<div class="checkout-summary__item" role="listitem">' +
          '<div class="checkout-summary__item-img-wrap">' +
            '<img src="' + escapeAttr(item.image) + '" alt="' + escapeAttr(item.name) + '" class="checkout-summary__item-img">' +
            '<span class="checkout-summary__item-qty">1</span>' +
          '</div>' +
          '<div class="checkout-summary__item-info">' +
            '<h4>' + escapeAttr(item.name) + '</h4>' +
            (variantLine ? '<p class="checkout-summary__item-variant">' + escapeAttr(variantLine) + '</p>' : '') +
            (isFree ? '<p class="checkout-summary__item-promo">PROMO [-' + formatPrice(priceSale) + ']</p>' : '') +
            '<div class="checkout-summary__item-price">' + priceHtml + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    container.innerHTML = html;

    if (discountRow) discountRow.style.display = totalDiscount > 0 ? 'flex' : 'none';
    if (discountVal) discountVal.textContent = '-' + formatPrice(totalDiscount);
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (subtotalLabel) subtotalLabel.textContent = 'Subtotal • ' + items.length + ' ' + (items.length === 1 ? 'item' : 'itens');
    if (totalEl) totalEl.textContent = formatPrice(totalAfterDiscount);
    if (savingsRow) savingsRow.style.display = totalDiscount > 0 ? 'flex' : 'none';
    if (savingsVal) savingsVal.textContent = formatPrice(totalDiscount);
  }

  function getShippingCost() {
    const selected = document.querySelector('input[name="shipping"]:checked');
    return selected?.value === 'express' ? SHIPPING_EXPRESS_PRICE : 0;
  }

  function updateCheckoutShippingAndTotal() {
    const shippingValueEl = document.getElementById('checkout-shipping-value');
    const totalEl = document.getElementById('checkout-total');
    if (!shippingValueEl || !totalEl) return;
    const items = getCart();
    const subtotal = getSubtotal(items);
    const couponDiscount = getEffectiveCouponDiscount(subtotal);
    const shipping = getShippingCost();
    shippingValueEl.textContent = shipping > 0 ? formatPrice(shipping) : 'Grátis';
    totalEl.textContent = formatPrice(subtotal - couponDiscount + shipping);
    updateParcelasOptions();
  }

  function updateParcelasOptions() {
    var select = document.getElementById('checkout-parcelas');
    if (!select) return;
    const items = getCart();
    const subtotal = getSubtotal(items);
    const couponDiscount = getEffectiveCouponDiscount(subtotal);
    const shipping = getShippingCost();
    const total = Math.max(0, subtotal - couponDiscount + shipping);
    const minParcel = total * 0.2;
    const maxParcelas = minParcel > 0 ? Math.min(12, Math.floor(total / minParcel)) : 1;
    var numParcelas = Math.max(1, isNaN(maxParcelas) ? 1 : maxParcelas);
    select.replaceChildren();
    for (var n = 1; n <= numParcelas; n++) {
      const valor = total / n;
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n === 1 ? '1x de ' + formatPrice(valor) + ' *' : n + 'x de ' + formatPrice(valor) + ' *';
      select.appendChild(opt);
    }
  }

  function renderShippingOptionsContent() {
    var container = document.getElementById('shippingOptions');
    if (!container) return;
    container.innerHTML = '<label class="checkout-form__shipping-option"><input type="radio" name="shipping" value="express"><span class="checkout-form__shipping-label"><strong>Entrega Expressa</strong><span class="checkout-form__shipping-days">1 à 3 dias úteis</span></span><span class="checkout-form__shipping-price">R$ 19,90</span></label><label class="checkout-form__shipping-option"><input type="radio" name="shipping" value="free" checked><span class="checkout-form__shipping-label"><strong>Entrega Grátis</strong><span class="checkout-form__shipping-days">3 à 5 dias úteis</span></span><span class="checkout-form__shipping-price checkout-form__shipping-price--free">Grátis</span></label>';
  }

  function syncShippingUIState() {
    var stateSelect = document.getElementById('checkout-state');
    var hintEl = document.getElementById('shippingHint');
    var loadingEl = document.getElementById('shippingLoading');
    var optionsEl = document.getElementById('shippingOptions');
    var stateVal = stateSelect ? (stateSelect.value || '').trim() : '';
    var freightLoaded = !!stateVal;
    if (!freightLoaded) {
      if (hintEl) hintEl.hidden = false;
      if (loadingEl) loadingEl.hidden = true;
      if (optionsEl) optionsEl.hidden = true;
    } else {
      if (hintEl) hintEl.hidden = true;
      if (loadingEl) loadingEl.hidden = true;
      if (optionsEl) {
        renderShippingOptionsContent();
        optionsEl.hidden = false;
      }
      updateCheckoutShippingAndTotal();
    }
  }

  function showShippingLoadingThenMethods(onDone) {
    var hintEl = document.getElementById('shippingHint');
    var loadingEl = document.getElementById('shippingLoading');
    var optionsEl = document.getElementById('shippingOptions');
    if (hintEl) hintEl.hidden = true;
    if (loadingEl) loadingEl.hidden = false;
    if (optionsEl) optionsEl.hidden = true;
    setTimeout(function () {
      if (loadingEl) loadingEl.hidden = true;
      if (optionsEl) {
        renderShippingOptionsContent();
        optionsEl.hidden = false;
      }
      updateCheckoutShippingAndTotal();
      if (typeof onDone === 'function') onDone();
    }, 1500);
  }

  function maskPhone(input) {
    if (!input) return;
    let v = (input.value || '').replace(/\D/g, '');
    if (v.startsWith('55') && v.length > 11) v = v.slice(2);
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
    v = v.replace(/(\d)(\d{4})$/, '$1-$2');
    input.value = v;
  }

  function maskCep(input) {
    let v = (input.value || '').replace(/\D/g, '');
    if (v.length > 8) v = v.slice(0, 8);
    v = v.replace(/(\d{5})(\d)/, '$1-$2');
    input.value = v;
  }

  function maskCpf(input) {
    let v = (input.value || '').replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = v;
  }

  function validateCpf(cpf) {
    const digits = (cpf || '').replace(/\D/g, '');
    if (digits.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(digits)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
    let d1 = (sum * 10) % 11;
    if (d1 === 10) d1 = 0;
    if (d1 !== parseInt(digits[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
    let d2 = (sum * 10) % 11;
    if (d2 === 10) d2 = 0;
    return d2 === parseInt(digits[10]);
  }

  function maskCardNumber(input) {
    let v = (input.value || '').replace(/\D/g, '');
    v = v.replace(/(\d{4})(?=\d)/g, '$1 ');
    input.value = v;
  }

  function maskExpiry(input) {
    let v = (input.value || '').replace(/\D/g, '');
    if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2, 4);
    input.value = v;
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
  }

  function digitsOnly(val) {
    return (val || '').replace(/\D/g, '');
  }

  function validatePhone(phone) {
    let d = digitsOnly(phone);
    if (d.startsWith('55') && d.length > 11) d = d.slice(2);
    return d.length >= 10 && d.length <= 11;
  }

  function showError(field, msg) {
    const el = document.querySelector('[data-field="' + field + '"]');
    if (el) {
      el.textContent = msg;
      el.closest('.checkout-form__field')?.classList.add('has-error');
    }
  }

  function clearErrors() {
    document.querySelectorAll('.checkout-form__error').forEach(el => { el.textContent = ''; });
    document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
  }

  function setCheckoutStep(stepNumber) {
    var container = document.getElementById('checkoutSteps');
    if (!container || stepNumber < 1 || stepNumber > 3) return;
    container.setAttribute('data-step', String(stepNumber));
    var steps = container.querySelectorAll('.step');
    steps.forEach(function (step, i) {
      var num = i + 1;
      step.classList.remove('is-done', 'is-active');
      step.removeAttribute('aria-current');
      if (num < stepNumber) step.classList.add('is-done');
      else if (num === stepNumber) {
        step.classList.add('is-active');
        step.setAttribute('aria-current', 'step');
      }
    });
  }

  function goToStep(stepNum) {
    var stepPersonal = document.getElementById('stepPersonal');
    var stepDelivery = document.getElementById('stepDelivery');
    var stepPayment = document.getElementById('stepPayment');
    if (!stepPersonal || !stepDelivery || !stepPayment) return;
    setCheckoutStep(stepNum);
    stepPersonal.classList.toggle('step-checkout__card--active', stepNum === 1);
    stepPersonal.classList.toggle('step-checkout__card--collapsed', stepNum !== 1);
    stepPersonal.setAttribute('aria-expanded', stepNum === 1 ? 'true' : 'false');
    stepPersonal.querySelector('.step-checkout__card-teaser')?.classList.toggle('step-checkout__card-teaser--hidden', stepNum === 1);
    stepPersonal.querySelector('.step-checkout__card-content')?.classList.toggle('step-checkout__card-content--hidden', stepNum !== 1);
    if (stepNum === 2) updateStepPersonalSummary();
    stepDelivery.classList.toggle('step-checkout__card--active', stepNum === 2);
    stepDelivery.classList.toggle('step-checkout__card--collapsed', stepNum !== 2);
    stepDelivery.setAttribute('aria-expanded', stepNum === 2 ? 'true' : 'false');
    stepDelivery.querySelector('.step-checkout__card-teaser')?.classList.toggle('step-checkout__card-teaser--hidden', stepNum === 2);
    stepDelivery.querySelector('.step-checkout__card-content')?.classList.toggle('step-checkout__card-content--hidden', stepNum !== 2);
    if (stepNum === 1 || stepNum === 3) updateStepDeliverySummary();
    if (stepNum === 2) {
      var btnEscolher = document.getElementById('btnEscolherFrete');
      var btnCont2 = document.getElementById('btnStep2Continue');
      if (btnEscolher) { btnEscolher.style.display = ''; btnEscolher.disabled = true; }
      if (btnCont2) btnCont2.style.display = 'none';
      checkDeliveryAddressComplete();
    }
    stepPayment.classList.toggle('step-checkout__card--active', stepNum === 3);
    stepPayment.classList.toggle('step-checkout__card--collapsed', stepNum !== 3);
    stepPayment.setAttribute('aria-expanded', stepNum === 3 ? 'true' : 'false');
    stepPayment.querySelector('.step-checkout__card-teaser')?.classList.toggle('step-checkout__card-teaser--hidden', stepNum === 3);
    stepPayment.querySelector('.step-checkout__card-content')?.classList.toggle('step-checkout__card-content--hidden', stepNum !== 3);
    if (stepNum === 3) updatePaymentOptionsForCoupon();
  }

  function updateDiscountSectionState() {
    var input = document.getElementById('checkout-discount-input');
    var btn = document.getElementById('checkout-apply-discount');
    var badge = document.getElementById('checkout-coupon-badge');
    if (!input || !btn) return;
    if (appliedCoupon) {
      input.readOnly = true;
      input.classList.add('is-applied');
      btn.disabled = true;
      btn.textContent = 'Cupom aplicado';
      btn.classList.add('is-applied');
      if (badge) badge.style.display = 'none';
    } else {
      input.readOnly = false;
      input.classList.remove('is-applied');
      btn.disabled = false;
      btn.textContent = 'Aplicar';
      btn.classList.remove('is-applied');
      if (badge) badge.style.display = 'inline-flex';
    }
  }

  function updatePaymentOptionsForCoupon() {
    var cardOption = document.querySelector('.checkout-form__payment-option--card');
    var cardRadio = document.getElementById('checkout-payment-card');
    var pixRadio = document.getElementById('checkout-payment-pix');
    var msgEl = document.getElementById('checkout-coupon-pix-only');
    if (!cardOption || !cardRadio || !pixRadio) return;
    /* Cupom NOPIX: desconto só no PIX; cartão continua disponível (não desativa). */
    if (appliedCoupon === COUPON_PIX_ONLY && msgEl) {
      msgEl.style.display = 'flex';
    } else if (msgEl) {
      msgEl.style.display = 'none';
    }
    cardOption.classList.remove('is-disabled');
    cardRadio.disabled = false;
  }

  function validateStep1(formCustomer) {
    var email = formCustomer?.querySelector('input[name="email"]')?.value?.trim() || '';
    var phoneInput = document.getElementById('checkout-phone');
    var phoneDigits = phoneInput ? digitsOnly(phoneInput.value) : '';
    var phone = phoneInput ? phoneInput.value.trim() : '';
    var firstName = formCustomer?.querySelector('input[name="first_name"]')?.value?.trim() || '';
    var cpf = formCustomer?.querySelector('input[name="cpf"]')?.value?.trim() || '';
    clearErrors();
    var valid = true;
    if (!email) { showError('email', 'E-mail é obrigatório'); valid = false; }
    else if (!validateEmail(email)) { showError('email', 'E-mail inválido'); valid = false; }
    if (phoneDigits.length > 0 && phoneDigits.length < 10) { showError('phone', 'Telefone inválido (mín. 10 dígitos)'); valid = false; }
    else if (phone && !validatePhone(phone)) { showError('phone', 'Telefone inválido'); valid = false; }
    if (!firstName) { showError('firstName', 'Nome é obrigatório'); valid = false; }
    if (!cpf) { showError('cpf', 'CPF é obrigatório'); valid = false; }
    else if (!validateCpf(cpf)) { showError('cpf', 'CPF inválido'); valid = false; }
    return valid;
  }

  function checkPersonalComplete() {
    var fn = document.getElementById('checkout-first-name')?.value?.trim() || '';
    var em = document.getElementById('checkout-email')?.value?.trim() || '';
    var ph = document.getElementById('checkout-phone')?.value?.trim() || '';
    var cpf = document.getElementById('checkout-cpf')?.value?.trim() || '';
    var ok = fn && em && validateEmail(em) && cpf && validateCpf(cpf) && (!ph || validatePhone(ph));
    var btn = document.getElementById('btnStep1Continue');
    if (btn) btn.disabled = !ok;
  }

  function validateStep2(formShipping) {
    var postalCode = formShipping?.querySelector('input[name="postalCode"]')?.value?.trim() || '';
    var address = formShipping?.querySelector('input[name="address"]')?.value?.trim() || '';
    var addressNumber = formShipping?.querySelector('input[name="addressNumber"]')?.value?.trim() || '';
    var neighborhood = formShipping?.querySelector('input[name="neighborhood"]')?.value?.trim() || '';
    var city = formShipping?.querySelector('input[name="city"]')?.value?.trim() || '';
    var state = formShipping?.querySelector('select[name="state"]')?.value || '';
    var shippingSelected = formShipping?.querySelector('input[name="shipping"]:checked');
    clearErrors();
    var valid = true;
    if (!postalCode) { showError('postalCode', 'CEP é obrigatório'); valid = false; }
    else if (postalCode.replace(/\D/g, '').length !== 8) { showError('postalCode', 'CEP deve ter 8 dígitos'); valid = false; }
    if (!address) { showError('address', 'Endereço é obrigatório'); valid = false; }
    if (!addressNumber) { showError('addressNumber', 'Número é obrigatório'); valid = false; }
    if (!neighborhood) { showError('neighborhood', 'Bairro é obrigatório'); valid = false; }
    if (!city) { showError('city', 'Cidade é obrigatória'); valid = false; }
    if (!state) { showError('state', 'Estado é obrigatório'); valid = false; }
    if (!shippingSelected) {
      alert('Selecione um método de envio antes de continuar.');
      valid = false;
    }
    return valid;
  }

  function updateStepPersonalSummary() {
    var fn = document.getElementById('checkout-first-name')?.value?.trim() || '';
    var em = document.getElementById('checkout-email')?.value?.trim() || '';
    var ph = document.getElementById('checkout-phone')?.value?.trim() || '';
    var cpf = document.getElementById('checkout-cpf')?.value?.trim() || '';
    var nameEl = document.getElementById('summaryName');
    var emailEl = document.getElementById('summaryEmail');
    var phoneEl = document.getElementById('summaryPhone');
    var cpfEl = document.getElementById('summaryCpf');
    if (nameEl) nameEl.textContent = fn || '—';
    if (emailEl) emailEl.textContent = em || '—';
    if (phoneEl) phoneEl.textContent = ph || '—';
    if (cpfEl) cpfEl.textContent = cpf || '—';
  }

  function updateStepDeliverySummary() {
    var address = document.getElementById('checkout-address')?.value?.trim() || '';
    var number = document.getElementById('checkout-address-number')?.value?.trim() || '';
    var neighborhood = document.getElementById('checkout-neighborhood')?.value?.trim() || '';
    var city = document.getElementById('checkout-city')?.value?.trim() || '';
    var stateVal = document.getElementById('checkout-state')?.value || '';
    var postalCode = document.getElementById('checkout-postalCode')?.value?.replace(/\D/g, '') || '';
    var addrEl = document.getElementById('summaryAddress');
    var neighborhoodCityEl = document.getElementById('summaryNeighborhoodCity');
    var cepEl = document.getElementById('summaryCep');
    var hintEl = document.getElementById('stepDeliveryHint');
    var descEl = document.getElementById('stepDeliveryDesc');
    var summaryEl = document.getElementById('stepDeliveryDataSummary');
    var btnEditDelivery = document.getElementById('btnEditDelivery');
    var hasData = address && number && neighborhood && city && stateVal && postalCode.length === 8;
    if (hintEl) hintEl.style.display = hasData ? 'none' : '';
    if (descEl) descEl.style.display = hasData ? '' : 'none';
    if (summaryEl) summaryEl.style.display = hasData ? '' : 'none';
    if (btnEditDelivery) btnEditDelivery.style.display = hasData ? '' : 'none';
    var addrLine = [address, number].filter(Boolean).join(', ') || '—';
    var cityState = stateVal && city ? city + '/' + stateVal : city || stateVal || '—';
    var cepFormatted = postalCode.length === 8 ? postalCode : '—';
    if (addrEl) addrEl.textContent = addrLine;
    if (neighborhoodCityEl) neighborhoodCityEl.textContent = [neighborhood, cityState].filter(Boolean).join(', ') || '—';
    if (cepEl) cepEl.textContent = cepFormatted;
  }

  var cepModalShownAt = 0;

  function showCepLoadingModal() {
    cepModalShownAt = Date.now();
    var modal = document.getElementById('cep-loading-modal');
    if (modal) { modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); }
  }

  function hideCepLoadingModal() {
    var minVisible = 1800;
    var elapsed = Date.now() - cepModalShownAt;
    var delay = Math.max(0, minVisible - elapsed);
    var modal = document.getElementById('cep-loading-modal');
    function close() {
      if (modal) { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); }
    }
    if (delay > 0) setTimeout(close, delay);
    else close();
  }

  function applyCepToForm(data) {
    var addr = document.getElementById('checkout-address');
    var neigh = document.getElementById('checkout-neighborhood');
    var city = document.getElementById('checkout-city');
    var state = document.getElementById('checkout-state');
    var street = data.street || data.logradouro || '';
    var neighborhood = data.neighborhood || data.bairro || '';
    var cityName = data.city || data.localidade || '';
    var stateUf = data.state || data.uf || '';
    if (addr) addr.value = street;
    if (neigh) neigh.value = neighborhood;
    if (city) city.value = cityName;
    if (state) state.value = stateUf;
    var revealEl = document.getElementById('addressFieldsReveal');
    if (revealEl) revealEl.removeAttribute('hidden');
    checkDeliveryAddressComplete();
  }

  function fetchCep(cep) {
    var digitsCep = digitsOnly(cep);
    if (digitsCep.length !== 8) return;
    var statusEl = document.getElementById('cepStatus');
    if (statusEl) statusEl.textContent = 'Procurando CEP...';
    showCepLoadingModal();

    function onSuccess(data) {
      hideCepLoadingModal();
      if (statusEl) statusEl.textContent = '';
      if (data.erro) {
        if (statusEl) statusEl.textContent = 'CEP não encontrado';
        var revealEl = document.getElementById('addressFieldsReveal');
        if (revealEl) revealEl.setAttribute('hidden', '');
        checkDeliveryAddressComplete();
        return;
      }
      applyCepToForm(data);
    }

    function onError() {
      hideCepLoadingModal();
      if (statusEl) statusEl.textContent = 'Erro ao buscar';
      var revealEl = document.getElementById('addressFieldsReveal');
      if (revealEl) revealEl.setAttribute('hidden', '');
      checkDeliveryAddressComplete();
    }

    fetch('https://brasilapi.com.br/api/cep/v1/' + digitsCep)
      .then(function (r) {
        if (r.ok) return r.json();
        if (r.status === 404) return null;
        throw new Error('BrasilAPI error');
      })
      .then(function (data) {
        if (data) {
          onSuccess(data);
          return;
        }
        return fetch('https://viacep.com.br/ws/' + digitsCep + '/json/').then(function (r) { return r.json(); });
      })
      .then(function (data) {
        if (!data) return;
        if (data.erro) {
          hideCepLoadingModal();
          if (statusEl) statusEl.textContent = 'CEP não encontrado';
          var revealEl = document.getElementById('addressFieldsReveal');
          if (revealEl) revealEl.setAttribute('hidden', '');
          checkDeliveryAddressComplete();
          return;
        }
        onSuccess(data);
      })
      .catch(function () { onError(); });
  }

  function checkDeliveryAddressComplete() {
    var cep = document.getElementById('checkout-postalCode')?.value?.replace(/\D/g, '') || '';
    var address = document.getElementById('checkout-address')?.value?.trim() || '';
    var number = document.getElementById('checkout-address-number')?.value?.trim() || '';
    var neighborhood = document.getElementById('checkout-neighborhood')?.value?.trim() || '';
    var btn = document.getElementById('btnEscolherFrete');
    var complete = cep.length === 8 && address && number && neighborhood;
    if (btn) btn.disabled = !complete;
  }

  function init() {
    const items = getCart();
    renderSummary(items);
    updateParcelasOptions();

    var formCustomer = document.getElementById('formCustomer');
    var formShipping = document.getElementById('formShipping');

    formCustomer?.querySelector('input[name="phone"]')?.addEventListener('input', function (e) {
      maskPhone(e.target);
      checkPersonalComplete();
    });
    formCustomer?.querySelector('input[name="cpf"]')?.addEventListener('input', function (e) {
      maskCpf(e.target);
      checkPersonalComplete();
    });
    formCustomer?.addEventListener('input', checkPersonalComplete);
    formCustomer?.addEventListener('change', checkPersonalComplete);
    checkPersonalComplete();

    (function syncNamePlaceholder() {
      var inp = document.getElementById('checkout-first-name');
      var ph = document.getElementById('checkout-first-name-placeholder');
      if (!inp || !ph) return;
      function update() {
        ph.classList.toggle('is-hidden', (inp.value || '').trim().length > 0);
      }
      inp.addEventListener('input', update);
      inp.addEventListener('change', update);
      update();
    })();

    formShipping?.querySelector('input[name="postalCode"]')?.addEventListener('input', function (e) {
      maskCep(e.target);
      var digits = e.target.value.replace(/\D/g, '');
      if (digits.length === 8) fetchCep(e.target.value);
    });
    formShipping?.querySelectorAll('input[name="address"], input[name="addressNumber"], input[name="neighborhood"]').forEach(function (inp) {
      inp.addEventListener('input', checkDeliveryAddressComplete);
    });
    updateStepDeliverySummary();

    document.getElementById('btnEditPersonal')?.addEventListener('click', function () { goToStep(1); });
    document.getElementById('btnEditDelivery')?.addEventListener('click', function () { goToStep(2); });
    document.getElementById('btnEscolherFrete')?.addEventListener('click', function () {
      var btnContinue = document.getElementById('btnStep2Continue');
      var btnShipping = document.getElementById('btnEscolherFrete');
      if (btnShipping) btnShipping.style.display = 'none';
      showShippingLoadingThenMethods(function () {
        if (btnContinue) btnContinue.style.display = '';
      });
    });

    function updateSubmitButtonText() {
      var btn = document.getElementById('checkout-submit');
      if (!btn) return;
      var payment = formShipping?.querySelector('input[name="payment"]:checked')?.value;
      btn.textContent = payment === 'pix' ? 'Ir para Mercado Pago' : 'Finalizar compra';
    }
    updateSubmitButtonText();
    formShipping?.querySelectorAll('input[name="payment"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        updateSubmitButtonText();
        updateCheckoutShippingAndTotal();
        renderSummary(getCart());
        if (radio.value === 'card') updateParcelasOptions();
      });
    });
    formShipping?.addEventListener('change', function (e) {
      if (e.target && e.target.getAttribute('name') === 'shipping') updateCheckoutShippingAndTotal();
    });

    var stateSelect = document.getElementById('checkout-state');
    syncShippingUIState();
    stateSelect?.addEventListener('change', function () {
      var val = stateSelect ? (stateSelect.value || '').trim() : '';
      if (val) showShippingLoadingThenMethods();
      else syncShippingUIState();
    });

    formShipping?.querySelector('input[name="cardNumber"]')?.addEventListener('input', function (e) { maskCardNumber(e.target); });
    formShipping?.querySelector('input[name="cardExpiry"]')?.addEventListener('input', function (e) { maskExpiry(e.target); });

    document.getElementById('btnStep1Continue')?.addEventListener('click', function () {
      if (validateStep1(formCustomer)) {
        updateStepPersonalSummary();
        goToStep(2);
      }
    });
    document.getElementById('btnStep2Continue')?.addEventListener('click', function () {
      if (validateStep2(formShipping)) goToStep(3);
    });

    document.getElementById('checkout-coupon-badge')?.addEventListener('click', function () {
      if (this.disabled) return;
      var input = document.getElementById('checkout-discount-input');
      var applyBtn = document.getElementById('checkout-apply-discount');
      if (input && applyBtn) {
        input.value = 'NOPIX';
        applyBtn.click();
      }
    });
    document.getElementById('checkout-apply-discount')?.addEventListener('click', function () {
      var input = document.getElementById('checkout-discount-input');
      var code = input?.value?.trim();
      if (!code) {
        alert('Digite um código de desconto.');
        return;
      }
      var coupon = getCouponByCode(code);
      if (coupon) {
        appliedCoupon = coupon.code;
        if (input) input.value = coupon.code;
        alert('Cupom ' + coupon.code + ' aplicado! Você ganhou ' + (coupon.displayPercent != null ? coupon.displayPercent : coupon.percent) + '% de desconto.');
        renderSummary(getCart());
        updateCheckoutShippingAndTotal();
        updatePaymentOptionsForCoupon();
        updateDiscountSectionState();
      } else {
        appliedCoupon = null;
        updatePaymentOptionsForCoupon();
        updateDiscountSectionState();
        alert('Código de desconto não encontrado. Verifique e tente novamente.');
      }
    });

    var summaryToggle = document.getElementById('checkout-summary-toggle');
    if (summaryToggle) {
      summaryToggle.addEventListener('click', function () {
        var expanded = summaryToggle.getAttribute('aria-expanded') === 'true';
        summaryToggle.setAttribute('aria-expanded', !expanded);
      });
    }

    var itemsEl = document.getElementById('checkout-items');
    var scrollHint = document.getElementById('checkout-scroll-hint');
    if (itemsEl && scrollHint) {
      var checkScroll = function () {
        scrollHint.classList.toggle('is-visible', itemsEl.scrollHeight > itemsEl.clientHeight && getCart().length > 2);
      };
      requestAnimationFrame(checkScroll);
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(checkScroll).observe(itemsEl);
      }
    }

    document.getElementById('checkout-submit')?.addEventListener('click', function () {
      if (getCart().length === 0) {
        alert('Seu carrinho está vazio. Adicione itens antes de finalizar.');
        return;
      }
      clearErrors();

      var email = formCustomer?.querySelector('input[name="email"]')?.value?.trim() || '';
      var firstName = formCustomer?.querySelector('input[name="first_name"]')?.value?.trim() || '';
      var cpf = formCustomer?.querySelector('input[name="cpf"]')?.value?.trim() || '';
      var postalCode = formShipping?.querySelector('input[name="postalCode"]')?.value?.trim() || '';
      var address = formShipping?.querySelector('input[name="address"]')?.value?.trim() || '';
      var city = formShipping?.querySelector('input[name="city"]')?.value?.trim() || '';
      var state = formShipping?.querySelector('select[name="state"]')?.value || '';
      var payment = formShipping?.querySelector('input[name="payment"]:checked')?.value;
      var addressNumber = formShipping?.querySelector('input[name="addressNumber"]')?.value?.trim() || '';
      var neighborhood = formShipping?.querySelector('input[name="neighborhood"]')?.value?.trim() || '';

      var valid = true;
      if (!email) { showError('email', 'E-mail é obrigatório'); valid = false; }
      else if (!validateEmail(email)) { showError('email', 'E-mail inválido'); valid = false; }
      if (!firstName) { showError('firstName', 'Nome é obrigatório'); valid = false; }
      if (!cpf) { showError('cpf', 'CPF é obrigatório'); valid = false; }
      else if (!validateCpf(cpf)) { showError('cpf', 'CPF inválido'); valid = false; }
      if (!postalCode) { showError('postalCode', 'CEP é obrigatório'); valid = false; }
      else if (postalCode.replace(/\D/g, '').length !== 8) { showError('postalCode', 'CEP deve ter 8 dígitos'); valid = false; }
      if (!address) { showError('address', 'Endereço é obrigatório'); valid = false; }
      if (!addressNumber) { showError('addressNumber', 'Número é obrigatório'); valid = false; }
      if (!neighborhood) { showError('neighborhood', 'Bairro é obrigatório'); valid = false; }
      if (!city) { showError('city', 'Cidade é obrigatória'); valid = false; }
      if (!state) { showError('state', 'Estado é obrigatório'); valid = false; }
      var shippingSelected = formShipping?.querySelector('input[name="shipping"]:checked');
      if (!shippingSelected) {
        alert('Selecione um método de envio antes de continuar.');
        valid = false;
      }

      if (payment === 'card') {
        var cardNumber = formShipping?.querySelector('input[name="cardNumber"]')?.value?.replace(/\s/g, '') || '';
        var cardExpiry = formShipping?.querySelector('input[name="cardExpiry"]')?.value || '';
        var cardCvv = formShipping?.querySelector('input[name="cardCvv"]')?.value || '';
        var cardName = formShipping?.querySelector('input[name="cardName"]')?.value?.trim() || '';
        if (cardNumber.length < 13) valid = false;
        if (!cardExpiry || cardExpiry.length < 5) valid = false;
        if (!cardCvv || cardCvv.length < 3) valid = false;
        if (!cardName) valid = false;
      }

      if (!valid) return;

      if (payment === 'pix') {
        var items = getCart();
        var subtotal = getSubtotal(items);
        var couponDiscount = getEffectiveCouponDiscount(subtotal);
        var shippingCost = getShippingCost();
        var total = subtotal - couponDiscount + shippingCost;
        var checkoutData = {
          items: items.map(function (i) {
            return {
              id: i.id,
              name: i.name,
              image: i.image,
              variant: i.variant,
              priceSale: i.priceSale,
              priceRegular: i.priceRegular,
              quantity: 1
            };
          }),
          total: total,
          subtotal: subtotal,
          couponDiscount: couponDiscount,
          shippingCost: shippingCost,
          customer: {
            email: email,
            firstName: firstName,
            lastName: formCustomer?.querySelector('input[name="last_name"]')?.value?.trim() || '',
            cpf: cpf,
            phone: formCustomer?.querySelector('input[name="phone"]')?.value?.trim() || ''
          },
          shipping: {
            postalCode: postalCode,
            address: address,
            addressNumber: addressNumber,
            neighborhood: neighborhood,
            city: city,
            state: state
          },
          trackingParameters: null
        };
        try {
          var p = new URLSearchParams(window.location.search || '');
          if (p.get('utm_source') || p.get('utm_campaign') || p.get('utm_medium') || p.get('utm_content') || p.get('utm_term') || p.get('src') || p.get('sck')) {
            checkoutData.trackingParameters = {
              utm_source: p.get('utm_source') || null,
              utm_campaign: p.get('utm_campaign') || null,
              utm_medium: p.get('utm_medium') || null,
              utm_content: p.get('utm_content') || null,
              utm_term: p.get('utm_term') || null,
              src: p.get('src') || null,
              sck: p.get('sck') || null
            };
            sessionStorage.setItem('animacase_tracking', JSON.stringify(checkoutData.trackingParameters));
          }
        } catch (_) {}
        try {
          localStorage.setItem('animacase_checkout_data', JSON.stringify(checkoutData));
          localStorage.setItem('animacase_checkout_email', email);
        } catch (_) {}
        var mpModal = document.getElementById('checkout-mp-redirect-modal');
        if (mpModal) {
          mpModal.classList.add('is-open');
          mpModal.removeAttribute('aria-hidden');
        }
        var path = window.location.pathname || '';
        var mercadoPagoUrl = (path.indexOf('/produto/') !== -1 || path.indexOf('/animes/') !== -1) ? '../mercado-pago.html' : 'mercado-pago.html';
        setTimeout(function () {
          window.location.href = mercadoPagoUrl;
        }, 1800);
        return;
      }

      if (payment === 'card') {
        var modal = document.getElementById('checkout-modal');
        var loading = document.getElementById('checkout-modal-loading');
        var error = document.getElementById('checkout-modal-error');
        var msgSecondary = document.getElementById('checkout-modal-msg-secondary');
        if (modal && loading && error) {
          modal.setAttribute('aria-hidden', 'false');
          modal.classList.add('checkout-modal--open');
          loading.style.display = '';
          error.style.display = 'none';
          if (msgSecondary) msgSecondary.style.opacity = '0';
          setTimeout(function () {
            if (msgSecondary) msgSecondary.style.opacity = '1';
          }, 2200);
          setTimeout(function () {
            loading.style.display = 'none';
            error.style.display = '';
          }, 4500);
        }
        return;
      }

      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      alert('Pedido recebido! Em breve você receberá a confirmação por e-mail e telefone.');
      window.location.href = 'index.html?order=success';
    });

    function closeCardModal() {
      var modal = document.getElementById('checkout-modal');
      if (modal) {
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('checkout-modal--open');
      }
    }

    document.getElementById('checkout-modal-btn-close')?.addEventListener('click', closeCardModal);
    document.querySelector('.checkout-modal__backdrop')?.addEventListener('click', closeCardModal);
    document.getElementById('checkout-modal-btn-pix')?.addEventListener('click', function () {
      var pixRadio = document.querySelector('input[name="payment"][value="pix"]');
      if (pixRadio) {
        pixRadio.checked = true;
        pixRadio.closest('.checkout-form__payment-option')?.scrollIntoView({ behavior: 'smooth' });
      }
      closeCardModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
