/**
 * Carrinho flutuante - Kirkland Original
 * Estrutura pronta para order bumpers no futuro.
 */
(function () {
  // Script de UTMs Utmify (carregado uma única vez)
  try {
    if (!window.__utmifyUtmsLoaded) {
      window.__utmifyUtmsLoaded = true;
      var u = document.createElement("script");
      u.setAttribute("src", "https://cdn.utmify.com.br/scripts/utms/latest.js");
      u.setAttribute("data-utmify-prevent-xcod-sck", "");
      u.setAttribute("data-utmify-prevent-subids", "");
      u.setAttribute("async", "");
      u.setAttribute("defer", "");
      (document.head || document.documentElement).appendChild(u);
    }
  } catch (e) {}
  const STORAGE_KEY = 'animacase_cart';
  const PRICE_SALE = 34.90;
  const PRICE_REGULAR = 47.90;

  const BUMPER_PRODUCT = {
    name: 'Dermaroller System 0.50mm',
    image: 'https://cdn.sistemawbuy.com.br/arquivos/80affac0093284e190e5f9bbf372eb29/produtos/64b8584d13c3a/dermaroller-system-1-unidade-64b8584d3af21.png',
    url: '',
    priceSale: 22.90,
    priceRegular: 49.90,
    variant: '1 unidade'
  };

  function getCart() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    updateCartUI();
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

  /** Formata o variant (ex: "iphone-iphone-17-pro-max") para exibição: "Modelo: iPhone 17 Pro Max" */
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

  function getSubtotal(items) {
    return items.reduce((acc, i) => acc + getItemPrice(i), 0);
  }

  function escapeAttr(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function createCartDrawer() {
    const html = `
      <div class="cart-drawer__overlay" id="cart-overlay" aria-hidden="true"></div>
      <aside class="cart-drawer" id="cart-drawer" role="dialog" aria-label="Carrinho" aria-hidden="true">
        <div class="cart-drawer__inner">
          <header class="cart-drawer__header">
            <h2 class="cart-drawer__title">Meu carrinho <span class="cart-drawer__count" id="cart-count-label">• 0 itens</span></h2>
            <button type="button" class="cart-drawer__close" id="cart-close" aria-label="Fechar">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 17" width="20" height="20"><path d="M.865 15.978a.5.5 0 00.707.707l7.433-7.431 7.579 7.282a.501.501 0 00.846-.37.5.5 0 00-.153-.351L9.712 8.546l7.417-7.416a.5.5 0 10-.707-.708L8.991 7.853 1.413.573a.5.5 0 10-.693.72l7.563 7.268-7.418 7.417z" fill="currentColor"/></svg>
            </button>
          </header>

          <div class="cart-drawer__items-wrap">
            <ul class="cart-drawer__items" id="cart-items-list"></ul>
          </div>

          <section class="cart-drawer__recommendations" id="cart-recommendations-section" aria-hidden="false">
            <h3>Potencialize seu tratamento!</h3>
            <div class="cart-recommendation">
              <div class="cart-recommendation__track" id="cart-recommendation-track">
                <div class="cart-recommendation__slide" id="cart-bumper-slide">
                  <img src="https://cdn.sistemawbuy.com.br/arquivos/80affac0093284e190e5f9bbf372eb29/produtos/64b8584d13c3a/dermaroller-system-1-unidade-64b8584d3af21.png" alt="Dermaroller System 0.50mm" class="cart-recommendation__img">
                  <div class="cart-recommendation__info">
                    <h4>Dermaroller System 0.50mm</h4>
                    <p class="cart-recommendation__desc">O Dermaroller 0.50mm ajuda a estimular a pele e pode melhorar a absorção do Minoxidil.</p>
                    <div class="cart-recommendation__price"><s>R$ 49,90</s> R$ 22,90</div>
                    <button type="button" class="cart-recommendation__add" id="cart-bumper-add" aria-label="Adicionar ao carrinho">Adicionar</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer class="cart-drawer__footer">
            <div class="cart-drawer__subtotal">
              <span>Subtotal</span>
              <span id="cart-subtotal-value">R$ 0,00</span>
            </div>
            <button type="button" class="cart-drawer__checkout" id="cart-checkout">Finalizar Compra</button>
          </footer>
        </div>
      </aside>
    `;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstElementChild);
    document.body.appendChild(wrap.lastElementChild);
  }

  function renderCartItems(items) {
    const list = document.getElementById('cart-items-list');
    if (!list) return;

    if (items.length === 0) {
      list.innerHTML = '<li class="cart-drawer__empty">Seu carrinho está vazio.</li>';
      return;
    }

    list.innerHTML = items.map((item) => {
      const priceSale = getItemPrice(item);
      const priceRegular = parsePrice(item.priceRegular);
      const singlePrice = priceSale === priceRegular;
      const priceHtml = singlePrice
        ? '<span>' + formatPrice(priceSale) + '</span>'
        : '<span>' + formatPrice(priceSale) + '</span><s>' + formatPrice(priceRegular) + '</s>';
      const variantLabel = ''; /* Modelo/variant oculto */
      return (
        '<li class="cart-drawer__item" data-id="' + escapeAttr(item.id) + '">' +
          '<img src="' + escapeAttr(item.image) + '" alt="' + escapeAttr(item.name) + '" class="cart-drawer__item-img">' +
          '<div class="cart-drawer__item-info">' +
            '<h4>' + escapeAttr(item.name) + '</h4>' +
            (variantLabel ? '<p class="cart-drawer__item-variant">' + escapeAttr(variantLabel) + '</p>' : '') +
            '<div class="cart-drawer__item-price">' + priceHtml + '</div>' +
          '</div>' +
          '<button type="button" class="cart-drawer__item-remove" data-id="' + escapeAttr(item.id) + '" aria-label="Remover"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/><path d="M10 11v6M14 11v6"/></svg></button>' +
        '</li>'
      );
    }).join('');

    list.querySelectorAll('.cart-drawer__item-remove').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
    });
  }

  function updateCartUI() {
    const items = getCart();

    const countEls = document.querySelectorAll('.cart-count');
    countEls.forEach(el => {
      el.textContent = items.length;
      el.style.display = items.length ? 'flex' : 'none';
      el.setAttribute('aria-hidden', items.length ? 'false' : 'true');
    });

    const label = document.getElementById('cart-count-label');
    if (label) label.textContent = '• ' + items.length + (items.length === 1 ? ' item' : ' itens');

    const subtotal = getSubtotal(items);
    const subtotalVal = document.getElementById('cart-subtotal-value');
    const checkoutBtn = document.getElementById('cart-checkout');

    if (subtotalVal) subtotalVal.textContent = formatPrice(subtotal);
    if (checkoutBtn) checkoutBtn.textContent = 'Finalizar Compra';

    renderCartItems(items);

    var bumperInCart = items.some(function (i) { return i.name === BUMPER_PRODUCT.name; });
    var bumperBtn = document.getElementById('cart-bumper-add');
    if (bumperBtn) {
      if (bumperInCart) {
        bumperBtn.textContent = 'Adicionado';
        bumperBtn.disabled = true;
        bumperBtn.classList.add('is-added');
      } else {
        bumperBtn.textContent = 'Adicionar';
        bumperBtn.disabled = false;
        bumperBtn.classList.remove('is-added');
      }
    }
  }

  function openCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer) { drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false'); }
    if (overlay) { overlay.classList.add('is-visible'); overlay.setAttribute('aria-hidden', 'false'); }
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer) { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); }
    if (overlay) { overlay.classList.remove('is-visible'); overlay.setAttribute('aria-hidden', 'true'); }
    document.body.style.overflow = '';
  }

  /** Adicionar ao carrinho (chamado pelas PDPs ou botões). */
  function addToCart(product) {
    const items = getCart();
    const id = 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const item = {
      id,
      name: product.name || 'Capa Refletiva 3M',
      image: product.image || '',
      url: product.url || '',
      priceSale: product.priceSale != null ? parsePrice(product.priceSale) : PRICE_SALE,
      priceRegular: product.priceRegular != null ? parsePrice(product.priceRegular) : PRICE_REGULAR,
      variant: product.variant || null
    };
    items.push(item);
    saveCart(items);
    openCart();
  }

  function removeFromCart(id) {
    const items = getCart().filter(i => i.id !== id);
    saveCart(items);
  }

  function init() {
    createCartDrawer();
    updateCartUI();

    document.getElementById('cart-bumper-add')?.addEventListener('click', function (e) {
      e.preventDefault();
      if (getCart().some(function (i) { return i.name === BUMPER_PRODUCT.name; })) return;
      addToCart(BUMPER_PRODUCT);
    });

    const cartIcon = document.querySelector('#cart-toggle, a[href="/cart"]');
    if (cartIcon) {
      cartIcon.addEventListener('click', function (e) {
        e.preventDefault();
        openCart();
      });
      if (cartIcon.tagName === 'A') cartIcon.setAttribute('href', '#');
    }

    document.getElementById('cart-close')?.addEventListener('click', closeCart);
    document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
    document.getElementById('cart-checkout')?.addEventListener('click', function () {
      const items = getCart();
      if (items.length === 0) return;
      var path = window.location.pathname || '';
      var checkoutUrl = (path.indexOf('/produto/') !== -1 || path.indexOf('/animes/') !== -1) ? '../checkout.html' : 'checkout.html';
      window.location.href = checkoutUrl;
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeCart();
    });
  }

  window.animacaseCart = {
    addToCart: addToCart,
    getCart: getCart,
    openCart: openCart,
    closeCart: closeCart
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
