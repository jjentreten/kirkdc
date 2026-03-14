/**
 * Backend Kirkland Original
 * Serve arquivos estáticos, PIX (BrutalCash ativo / Marcha Pay legado) e Utmify (trackeamento)
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const PIX_PROVIDER = (process.env.PIX_PROVIDER || 'brutalcash').toLowerCase();

// BrutalCash (ativo por padrão)
const BRUTALCASH_PUBLIC_KEY = (process.env.BRUTALCASH_PUBLIC_KEY || '').trim();
const BRUTALCASH_SECRET_KEY = (process.env.BRUTALCASH_SECRET_KEY || '').trim();
const BRUTALCASH_CREATE_URL = 'https://api.brutalcash.com/v1/payment-transaction/create';
const BRUTALCASH_GET_URL = 'https://api.brutalcash.com/v1/payment-transaction';

// Marcha Pay (legado – usar PIX_PROVIDER=marchapay para ativar)
const MARCHABB_URL = 'https://api.marchabb.com/v1/transactions';
const MARCHABB_GET_URL = 'https://api.marchabb.com/v1/transactions';
const PUBLIC_KEY = process.env.MARCHABB_PUBLIC_KEY || '';
const SECRET_KEY = process.env.MARCHABB_SECRET_KEY || '';

const UTMIFY_URL = 'https://api.utmify.com.br/api-credentials/orders';
const UTMIFY_TOKEN = (process.env.UTMIFY_API_TOKEN || '').trim();
const SITE_URL = (process.env.SITE_URL || 'http://localhost:' + PORT).replace(/\/$/, '');
const PENDING_ORDERS_FILE = path.join(__dirname, 'data', 'pending-utmify-orders.json');
const POLL_INTERVAL_MS = 10 * 1000;

const PLATFORM_NAME = 'Kirkland Original';

app.use(cors());
app.use(express.json());

function ensureDataDir() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readPendingOrders() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(PENDING_ORDERS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function writePendingOrders(list) {
  ensureDataDir();
  fs.writeFileSync(PENDING_ORDERS_FILE, JSON.stringify(list, null, 0), 'utf8');
}

function toUtcDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return y + '-' + m + '-' + day + ' ' + h + ':' + min + ':' + s;
}

function buildUtmifyPayload(opts) {
  const {
    orderId,
    status,
    createdAt,
    approvedDate,
    refundedAt,
    customer,
    products,
    trackingParameters,
    totalPriceInCents
  } = opts;
  const gatewayFeeInCents = Math.round(totalPriceInCents * 0.01) || 0;
  const userCommissionInCents = Math.max(1, totalPriceInCents - gatewayFeeInCents);
  return {
    orderId: String(orderId),
    platform: PLATFORM_NAME,
    paymentMethod: 'pix',
    status,
    createdAt,
    approvedDate: approvedDate || null,
    refundedAt: refundedAt || null,
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone || null,
      document: customer.document || null,
      country: customer.country || 'BR',
      ip: customer.ip || '0.0.0.0'
    },
    products: products.map((p) => ({
      id: String(p.id || p.externalRef || p.name),
      name: p.name,
      planId: null,
      planName: null,
      quantity: p.quantity || 1,
      priceInCents: p.priceInCents
    })),
    trackingParameters: {
      src: trackingParameters?.src ?? null,
      sck: trackingParameters?.sck ?? null,
      utm_source: trackingParameters?.utm_source ?? null,
      utm_campaign: trackingParameters?.utm_campaign ?? null,
      utm_medium: trackingParameters?.utm_medium ?? null,
      utm_content: trackingParameters?.utm_content ?? null,
      utm_term: trackingParameters?.utm_term ?? null
    },
    commission: {
      totalPriceInCents,
      gatewayFeeInCents,
      userCommissionInCents
    }
  };
}

async function sendToUtmify(payload) {
  if (!UTMIFY_TOKEN) {
    console.warn('Utmify: UTMIFY_API_TOKEN não configurado no .env - pedido não enviado');
    return;
  }
  try {
    const res = await fetch(UTMIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': UTMIFY_TOKEN
      },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('Utmify erro', res.status, text);
      return;
    }
    console.log('Utmify: pedido', payload.orderId, 'enviado com status', payload.status);
  } catch (err) {
    console.error('Utmify erro ao enviar:', err.message);
  }
}

// Normaliza payload do checkout Kirkland (items com priceSale, customer com firstName/lastName/cpf)
function normalizeCreatePixBody(body) {
  const { amount, total, items, customer, trackingParameters } = body;
  let amountCentavos = typeof amount === 'number' ? Math.round(amount) : 0;
  if (amountCentavos < 1 && typeof total === 'number') {
    amountCentavos = Math.round(total * 100);
  }
  const name = customer?.name || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim() || 'Cliente';
  const docNumber = (customer?.document?.number || customer?.cpf || '').replace(/\D/g, '');
  const phone = (customer?.phone || '').replace(/\D/g, '') || '11999999999';
  const normalizedItems = (items || []).map((item) => {
    const price = item.unitPrice ?? item.price ?? item.priceSale ?? 0;
    const unitPriceCents = price < 100 ? Math.round(Number(price) * 100) : Math.round(Number(price));
    return {
      title: item.title || item.name || 'Produto',
      name: item.name || item.title || 'Produto',
      unitPrice: unitPriceCents,
      price: unitPriceCents,
      quantity: item.quantity || 1,
      id: item.id,
      externalRef: item.id
    };
  });
  return {
    amountCentavos,
    customer: {
      name,
      email: (customer?.email || '').trim(),
      document: { number: docNumber, type: 'cpf' },
      phone: phone.length >= 10 ? '55' + phone : '5511999999999'
    },
    items: normalizedItems,
    trackingParameters: trackingParameters || {}
  };
}

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname)));

// POST /api/create-pix - Cria transação PIX (BrutalCash ou Marcha Pay conforme PIX_PROVIDER)
app.post('/api/create-pix', async (req, res) => {
  const raw = normalizeCreatePixBody(req.body);
  const { amountCentavos, customer, items, trackingParameters } = raw;

  if (amountCentavos < 1) {
    return res.status(400).json({ success: false, error: 'Valor inválido (amount ou total)' });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Lista de itens obrigatória' });
  }
  if (!customer || !customer.name || !customer.email) {
    return res.status(400).json({ success: false, error: 'Cliente obrigatório (name, email)' });
  }
  const docNumber = (customer.document?.number || '').replace(/\D/g, '');
  if (!docNumber || docNumber.length < 11) {
    return res.status(400).json({ success: false, error: 'CPF do cliente obrigatório' });
  }
  let phoneFixed = (customer.phone || '5511999999999').replace(/\D/g, '').slice(-11) || '11999999999';
  if (phoneFixed.length < 10) phoneFixed = '11999999999';

  const useBrutalCash = (PIX_PROVIDER === 'brutalcash' || PIX_PROVIDER !== 'marchapay') && BRUTALCASH_PUBLIC_KEY && BRUTALCASH_SECRET_KEY;
  const useMarchaPay = PIX_PROVIDER === 'marchapay' && PUBLIC_KEY && SECRET_KEY;

  if (useBrutalCash) {
    const auth = 'Basic ' + Buffer.from(BRUTALCASH_PUBLIC_KEY + ':' + BRUTALCASH_SECRET_KEY).toString('base64');
    const payload = {
      payment_method: 'pix',
      customer: {
        document: { type: 'cpf', number: docNumber },
        name: customer.name.trim(),
        email: customer.email.trim(),
        phone: '55' + phoneFixed
      },
      items: items.map((item) => ({
        title: item.title || item.name || 'Produto',
        unit_price: item.unitPrice || item.price,
        quantity: item.quantity || 1
      })),
      amount: amountCentavos,
      postback_url: SITE_URL ? SITE_URL + '/api/webhook-brutalcash' : undefined,
      metadata: { provider_name: PLATFORM_NAME }
    };
    try {
      const response = await fetch(BRUTALCASH_CREATE_URL, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const rawRes = await response.json();
      const inner = rawRes.response || rawRes;
      const data = inner.data || inner;
      if (rawRes.isError || !inner.success || !data) {
        const errMsg = (inner.error_messages && inner.error_messages[0]) || inner.inner_exception || rawRes.message || 'Erro ao criar PIX';
        return res.status(response.ok ? 500 : response.status).json({ success: false, error: String(errMsg) });
      }
      const qrcode = data.pix?.qr_code || data.pix?.qrcode || '';
      const transactionId = data.id;
      if (!qrcode) {
        return res.status(500).json({ success: false, error: 'Resposta BrutalCash sem QR Code PIX' });
      }
      const createdAt = toUtcDateTime(new Date());
      if (UTMIFY_TOKEN && transactionId) {
        const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || req.ip || '0.0.0.0';
        const ip = clientIp.replace(/^::ffff:/, '');
        const productsForUtmify = items.map((item) => ({
          id: item.id || item.externalRef,
          name: item.name || item.title || 'Produto',
          quantity: item.quantity || 1,
          priceInCents: item.unitPrice || item.price
        }));
        const utmifyPayload = buildUtmifyPayload({
          orderId: String(transactionId),
          status: 'waiting_payment',
          createdAt,
          approvedDate: null,
          refundedAt: null,
          customer: { name: customer.name.trim(), email: customer.email.trim(), phone: phoneFixed, document: docNumber, country: 'BR', ip: ip || '0.0.0.0' },
          products: productsForUtmify,
          trackingParameters: trackingParameters || {},
          totalPriceInCents: amountCentavos
        });
        await sendToUtmify(utmifyPayload);
        const pending = readPendingOrders();
        pending.push({ transactionId: String(transactionId), createdAt, utmifyPayload, provider: 'brutalcash' });
        writePendingOrders(pending);
      }
      return res.json({ success: true, transactionId, secureUrl: null, qrcode, amount: amountCentavos });
    } catch (err) {
      console.error('Erro BrutalCash:', err);
      return res.status(500).json({ success: false, error: err.message || 'Erro ao conectar com o gateway de pagamento' });
    }
  }

  if (useMarchaPay) {
    const payload = {
      amount: amountCentavos,
      currency: 'BRL',
      paymentMethod: 'pix',
      items: items.map((item) => ({
        title: item.title || item.name || 'Produto',
        unitPrice: item.unitPrice || item.price,
        quantity: item.quantity || 1,
        tangible: true,
        externalRef: item.externalRef || item.id
      })),
      customer: {
        name: customer.name.trim(),
        email: customer.email.trim(),
        phone: '55' + phoneFixed,
        document: { number: docNumber, type: 'cpf' }
      },
      externalRef: 'kirkland-' + Date.now()
    };
    if (SITE_URL) {
      payload.postbackUrl = SITE_URL + '/api/webhook-pix';
      payload.returnUrl = SITE_URL + '/checkout-pix-gerado.html?status=return';
    }
    const auth = 'Basic ' + Buffer.from(PUBLIC_KEY + ':' + SECRET_KEY).toString('base64');
    try {
      const response = await fetch(MARCHABB_URL, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: data.message || data.error || 'Erro ao criar transação PIX' });
      }
      const pix = data.pix || data.data?.pix;
      const secureUrl = data.secureUrl || data.data?.secureUrl;
      const qrcode = pix?.qrcode || pix?.copyPaste || '';
      const transactionId = data.id ?? data.data?.id ?? data.objectId;
      if (!qrcode && !secureUrl) {
        return res.status(500).json({ success: false, error: 'Resposta da Marcha Pay sem QR Code PIX' });
      }
      const createdAt = toUtcDateTime(new Date());
      if (UTMIFY_TOKEN && transactionId != null) {
        const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || req.ip || '0.0.0.0';
        const ip = clientIp.replace(/^::ffff:/, '');
        const productsForUtmify = items.map((item) => ({
          id: item.id || item.externalRef,
          name: item.name || item.title || 'Produto',
          quantity: item.quantity || 1,
          priceInCents: item.unitPrice || item.price
        }));
        const utmifyPayload = buildUtmifyPayload({
          orderId: String(transactionId),
          status: 'waiting_payment',
          createdAt,
          approvedDate: null,
          refundedAt: null,
          customer: { name: customer.name.trim(), email: customer.email.trim(), phone: '55' + phoneFixed, document: docNumber, country: 'BR', ip },
          products: productsForUtmify,
          trackingParameters: trackingParameters || {},
          totalPriceInCents: amountCentavos
        });
        await sendToUtmify(utmifyPayload);
        const pending = readPendingOrders();
        pending.push({ transactionId: String(transactionId), createdAt, utmifyPayload });
        writePendingOrders(pending);
      }
      return res.json({ success: true, transactionId, secureUrl, qrcode: qrcode || '', amount: payload.amount });
    } catch (err) {
      console.error('Erro Marcha Pay:', err);
      return res.status(500).json({ success: false, error: err.message || 'Erro ao conectar com o gateway de pagamento' });
    }
  }

  return res.status(500).json({
    success: false,
    error: 'Nenhum gateway PIX configurado. Defina PIX_PROVIDER=brutalcash e BRUTALCASH_PUBLIC_KEY/SECRET_KEY no .env (ou PIX_PROVIDER=marchapay com MARCHABB_*).'
  });
});

// POST /api/webhook-brutalcash - Recebe postbacks da BrutalCash
app.post('/api/webhook-brutalcash', (req, res) => {
  const body = req.body;
  const id = body.Id || body.id;
  const status = (body.Status || body.status || '').toUpperCase();
  console.log('Webhook BrutalCash:', id, status);
  if (status === 'PAID' && id) {
    const pending = readPendingOrders();
    const idx = pending.findIndex((p) => String(p.transactionId) === String(id) && p.provider === 'brutalcash');
    if (idx !== -1) {
      const row = pending[idx];
      const approvedDate = body.PaidAt ? toUtcDateTime(new Date(body.PaidAt)) : toUtcDateTime(new Date());
      const payload = { ...row.utmifyPayload, status: 'paid', approvedDate };
      sendToUtmify(payload).then(() => {
        pending.splice(idx, 1);
        writePendingOrders(pending);
        console.log('Utmify atualizado (webhook BrutalCash): pedido', id, 'pago');
      });
    }
  }
  res.status(200).send('OK');
});

// POST /api/webhook-pix - Marcha Pay (legado)
app.post('/api/webhook-pix', (req, res) => {
  console.log('Webhook Marcha Pay:', req.body?.type, req.body?.objectId, req.body?.data?.status);
  res.status(200).send('OK');
});

// GET /api/pix-status/:transactionId
app.get('/api/pix-status/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  if (!transactionId) return res.status(400).json({ status: 'unknown' });

  const useBrutalCash = (PIX_PROVIDER === 'brutalcash' || PIX_PROVIDER !== 'marchapay') && BRUTALCASH_PUBLIC_KEY && BRUTALCASH_SECRET_KEY;
  const useMarchaPay = PIX_PROVIDER === 'marchapay' && PUBLIC_KEY && SECRET_KEY;

  if (useBrutalCash) {
    try {
      const auth = 'Basic ' + Buffer.from(BRUTALCASH_PUBLIC_KEY + ':' + BRUTALCASH_SECRET_KEY).toString('base64');
      const response = await fetch(BRUTALCASH_GET_URL + '/' + encodeURIComponent(transactionId), {
        method: 'GET',
        headers: { 'Authorization': auth, 'Accept': 'application/json' }
      });
      const raw = response.ok ? await response.json() : null;
      const data = raw?.response?.data || raw?.data || raw;
      const status = (data?.status || data?.Status || 'unknown').toUpperCase();
      return res.json({ status: status === 'PAID' ? 'paid' : 'pending' });
    } catch (err) {
      console.error('pix-status BrutalCash:', err.message);
      return res.status(500).json({ status: 'unknown' });
    }
  }

  if (useMarchaPay) {
    try {
      const auth = 'Basic ' + Buffer.from(PUBLIC_KEY + ':' + SECRET_KEY).toString('base64');
      const response = await fetch(MARCHABB_GET_URL + '/' + encodeURIComponent(transactionId), {
        method: 'GET',
        headers: { 'Authorization': auth, 'Accept': 'application/json' }
      });
      const data = response.ok ? await response.json() : null;
      const status = data?.status ?? data?.data?.status ?? 'unknown';
      return res.json({ status: status === 'paid' || status === 'approved' ? 'paid' : 'pending' });
    } catch (err) {
      console.error('pix-status Marcha:', err.message);
      return res.status(500).json({ status: 'unknown' });
    }
  }

  res.json({ status: 'unknown' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

async function pollMarchaAndUpdateUtmify() {
  if (PIX_PROVIDER !== 'marchapay' || !PUBLIC_KEY || !SECRET_KEY || !UTMIFY_TOKEN) return;
  const pending = readPendingOrders().filter((p) => !p.provider || p.provider === 'marchapay');
  if (pending.length === 0) return;

  const auth = 'Basic ' + Buffer.from(PUBLIC_KEY + ':' + SECRET_KEY).toString('base64');
  const stillPending = [];

  for (const row of pending) {
    try {
      const res = await fetch(MARCHABB_GET_URL + '/' + encodeURIComponent(row.transactionId), {
        method: 'GET',
        headers: { 'Authorization': auth, 'Accept': 'application/json' }
      });
      const data = res.ok ? await res.json() : null;
      const status = data?.status ?? data?.data?.status;

      if (status === 'paid' || status === 'approved') {
        const paidAt = data?.paidAt ?? data?.data?.paidAt;
        const approvedDate = paidAt ? toUtcDateTime(new Date(paidAt)) : toUtcDateTime(new Date());
        const payload = { ...row.utmifyPayload, status: 'paid', approvedDate };
        await sendToUtmify(payload);
        console.log('Utmify atualizado: pedido', row.transactionId, 'pago');
      } else {
        stillPending.push(row);
      }
    } catch (err) {
      console.error('Poll Marcha:', row.transactionId, err.message);
      stillPending.push(row);
    }
  }

  if (stillPending.length !== pending.length) {
    const all = readPendingOrders();
    const brutalOnly = all.filter((p) => p.provider === 'brutalcash');
    writePendingOrders([...brutalOnly, ...stillPending]);
  }
}

let pollTimer = null;
function startPolling() {
  if (pollTimer) return;
  pollMarchaAndUpdateUtmify();
  pollTimer = setInterval(pollMarchaAndUpdateUtmify, POLL_INTERVAL_MS);
}

app.listen(PORT, () => {
  console.log('Kirkland Original rodando em http://localhost:' + PORT);
  const useBrutal = (PIX_PROVIDER === 'brutalcash' || PIX_PROVIDER !== 'marchapay') && BRUTALCASH_PUBLIC_KEY && BRUTALCASH_SECRET_KEY;
  const useMarcha = PIX_PROVIDER === 'marchapay' && PUBLIC_KEY && SECRET_KEY;
  if (useBrutal) {
    console.log('PIX: BrutalCash ativo.');
  } else if (useMarcha) {
    console.log('PIX: Marcha Pay ativo (legado).');
    if (UTMIFY_TOKEN) startPolling();
  } else {
    console.warn('AVISO: Nenhum gateway PIX ativo. Configure PIX_PROVIDER=brutalcash e BRUTALCASH_* no .env (ou marchapay com MARCHABB_*).');
  }
  if (UTMIFY_TOKEN) {
    console.log('Utmify: token configurado - pedidos serão enviados ao painel.');
    if (PIX_PROVIDER === 'marchapay') startPolling();
  } else {
    console.warn('AVISO: UTMIFY_API_TOKEN não configurado no .env. Trackeamento Utmify desativado.');
  }
});
