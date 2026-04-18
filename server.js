/**
 * Backend Kirkland Original
 * Serve arquivos estáticos, PIX e Cartão via Pagou, trackeamento via Utmify.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const PAGOU_API_KEY = (process.env.PAGOU_API_KEY || '').trim();
const PAGOU_PUBLIC_KEY = (process.env.PAGOU_PUBLIC_KEY || '').trim();
const PAGOU_ENV = (process.env.PAGOU_ENV || 'sandbox').toLowerCase();
const PAGOU_URL = 'https://api.pagou.ai/v2/transactions';

const UTMIFY_URL = 'https://api.utmify.com.br/api-credentials/orders';
const UTMIFY_TOKEN = (process.env.UTMIFY_API_TOKEN || '').trim();
const SITE_URL = (process.env.SITE_URL || 'http://localhost:' + PORT).replace(/\/$/, '');
const PENDING_ORDERS_FILE = path.join(__dirname, 'data', 'pending-utmify-orders.json');

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
    paymentMethod,
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
    paymentMethod: paymentMethod || 'pix',
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

function pagouHeaders() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'apiKey': PAGOU_API_KEY
  };
}

// Normaliza payload do checkout para campos internos
function normalizeCreatePaymentBody(body) {
  const { amount, total, items, customer, trackingParameters } = body;
  let amountCentavos = typeof amount === 'number' ? Math.round(amount) : 0;
  if (amountCentavos < 1 && typeof total === 'number') {
    amountCentavos = Math.round(total * 100);
  }
  const name = customer?.name || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim() || 'Cliente';
  const docNumber = (customer?.document?.number || customer?.cpf || '').replace(/\D/g, '');
  const rawPhone = (customer?.phone || '').replace(/\D/g, '');
  const phone = rawPhone.length >= 10 ? rawPhone.slice(-11) : '11999999999';
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
      phone
    },
    items: normalizedItems,
    trackingParameters: trackingParameters || {}
  };
}

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname)));

// GET /api/config - Configurações públicas para o frontend
app.get('/api/config', (req, res) => {
  res.json({ pagouPublicKey: PAGOU_PUBLIC_KEY, pagouEnv: PAGOU_ENV });
});

// POST /api/create-pix - Cria transação PIX via Pagou
app.post('/api/create-pix', async (req, res) => {
  const raw = normalizeCreatePaymentBody(req.body);
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
  if (!PAGOU_API_KEY) {
    return res.status(500).json({ success: false, error: 'Gateway não configurado. Defina PAGOU_API_KEY no .env' });
  }

  const externalRef = 'kirkland-' + Date.now();
  const payload = {
    external_ref: externalRef,
    amount: amountCentavos,
    currency: 'BRL',
    method: 'pix',
    notify_url: SITE_URL ? SITE_URL + '/api/webhook-pagou' : undefined,
    buyer: {
      name: customer.name.trim(),
      email: customer.email.trim(),
      phone: customer.phone,
      document: { type: 'cpf', number: docNumber }
    },
    products: items.map((item) => ({
      name: item.name || item.title || 'Produto',
      price: item.unitPrice || item.price,
      quantity: item.quantity || 1
    }))
  };

  try {
    const response = await fetch(PAGOU_URL, {
      method: 'POST',
      headers: pagouHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    if (!json.success || !json.data) {
      const errMsg = json.detail || json.title || json.message || 'Erro ao criar PIX';
      return res.status(response.ok ? 500 : response.status).json({ success: false, error: String(errMsg) });
    }
    const data = json.data;
    const qrcode = data.qr_code || '';
    const transactionId = data.id;
    if (!qrcode) {
      return res.status(500).json({ success: false, error: 'Pagou: QR Code PIX não retornado' });
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
        paymentMethod: 'pix',
        status: 'waiting_payment',
        createdAt,
        approvedDate: null,
        refundedAt: null,
        customer: { name: customer.name.trim(), email: customer.email.trim(), phone: customer.phone, document: docNumber, country: 'BR', ip },
        products: productsForUtmify,
        trackingParameters: trackingParameters || {},
        totalPriceInCents: amountCentavos
      });
      await sendToUtmify(utmifyPayload);
      const pending = readPendingOrders();
      pending.push({ transactionId: String(transactionId), createdAt, utmifyPayload });
      writePendingOrders(pending);
    }

    return res.json({ success: true, transactionId, qrcode, amount: amountCentavos });
  } catch (err) {
    console.error('Erro Pagou PIX:', err);
    return res.status(500).json({ success: false, error: err.message || 'Erro ao conectar com o gateway de pagamento' });
  }
});

// POST /api/create-card - Cria transação de cartão via Pagou (token gerado pelo Payment Element)
app.post('/api/create-card', async (req, res) => {
  const { token, installments, ...rest } = req.body;
  if (!token || !String(token).startsWith('pgct_')) {
    return res.status(400).json({ success: false, error: 'Token de cartão inválido' });
  }

  const raw = normalizeCreatePaymentBody(rest);
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
  if (!PAGOU_API_KEY) {
    return res.status(500).json({ success: false, error: 'Gateway não configurado. Defina PAGOU_API_KEY no .env' });
  }

  const parsedInstallments = Math.max(1, Math.min(12, parseInt(installments) || 1));
  const externalRef = 'kirkland-' + Date.now();
  const payload = {
    external_ref: externalRef,
    amount: amountCentavos,
    currency: 'BRL',
    method: 'credit_card',
    token: String(token),
    installments: parsedInstallments,
    notify_url: SITE_URL ? SITE_URL + '/api/webhook-pagou' : undefined,
    buyer: {
      name: customer.name.trim(),
      email: customer.email.trim(),
      phone: customer.phone,
      document: { type: 'cpf', number: docNumber }
    },
    products: items.map((item) => ({
      name: item.name || item.title || 'Produto',
      price: item.unitPrice || item.price,
      quantity: item.quantity || 1
    }))
  };

  try {
    const response = await fetch(PAGOU_URL, {
      method: 'POST',
      headers: pagouHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    if (!json.success || !json.data) {
      const errMsg = json.detail || json.title || json.message || 'Erro ao processar cartão';
      return res.status(response.ok ? 500 : response.status).json({ success: false, error: String(errMsg) });
    }
    const data = json.data;
    const transactionId = data.id;
    const status = (data.status || '').toLowerCase();
    const isPaid = status === 'paid' || status === 'captured' || status === 'authorized';

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
      const utmifyStatus = isPaid ? 'paid' : 'waiting_payment';
      const utmifyPayload = buildUtmifyPayload({
        orderId: String(transactionId),
        paymentMethod: 'credit_card',
        status: utmifyStatus,
        createdAt,
        approvedDate: isPaid ? createdAt : null,
        refundedAt: null,
        customer: { name: customer.name.trim(), email: customer.email.trim(), phone: customer.phone, document: docNumber, country: 'BR', ip },
        products: productsForUtmify,
        trackingParameters: trackingParameters || {},
        totalPriceInCents: amountCentavos
      });
      await sendToUtmify(utmifyPayload);
      if (!isPaid) {
        const pending = readPendingOrders();
        pending.push({ transactionId: String(transactionId), createdAt, utmifyPayload });
        writePendingOrders(pending);
      }
    }

    return res.json({ success: true, transactionId, status, isPaid });
  } catch (err) {
    console.error('Erro Pagou cartão:', err);
    return res.status(500).json({ success: false, error: err.message || 'Erro ao conectar com o gateway de pagamento' });
  }
});

// POST /api/webhook-pagou - Recebe eventos de pagamento da Pagou
app.post('/api/webhook-pagou', (req, res) => {
  const body = req.body;
  const id = body.id || body.data?.id;
  const status = (body.status || body.data?.status || '').toLowerCase();
  console.log('Webhook Pagou:', id, status);

  if (status === 'paid' && id) {
    const pending = readPendingOrders();
    const idx = pending.findIndex((p) => String(p.transactionId) === String(id));
    if (idx !== -1) {
      const row = pending[idx];
      const approvedDate = body.paid_at ? toUtcDateTime(new Date(body.paid_at)) : toUtcDateTime(new Date());
      const payload = { ...row.utmifyPayload, status: 'paid', approvedDate };
      sendToUtmify(payload).then(() => {
        pending.splice(idx, 1);
        writePendingOrders(pending);
        console.log('Utmify atualizado (webhook Pagou): pedido', id, 'pago');
      });
    }
  }
  res.status(200).send('OK');
});

// GET /api/pix-status/:transactionId - Consulta status de transação PIX
app.get('/api/pix-status/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  if (!transactionId) return res.status(400).json({ status: 'unknown' });
  if (!PAGOU_API_KEY) return res.json({ status: 'unknown' });

  try {
    const response = await fetch(PAGOU_URL + '/' + encodeURIComponent(transactionId), {
      method: 'GET',
      headers: pagouHeaders()
    });
    const json = response.ok ? await response.json() : null;
    const status = (json?.data?.status || '').toLowerCase();
    return res.json({ status: status === 'paid' ? 'paid' : 'pending' });
  } catch (err) {
    console.error('pix-status Pagou:', err.message);
    return res.status(500).json({ status: 'unknown' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('Kirkland Original rodando em http://localhost:' + PORT);
  if (PAGOU_API_KEY) {
    console.log('Pagou: API Key configurada. PIX + Cartão ativos. Ambiente:', PAGOU_ENV);
  } else {
    console.warn('AVISO: PAGOU_API_KEY não configurado no .env. Nenhum gateway ativo.');
  }
  if (UTMIFY_TOKEN) {
    console.log('Utmify: token configurado - pedidos serão enviados ao painel.');
  } else {
    console.warn('AVISO: UTMIFY_API_TOKEN não configurado no .env. Trackeamento Utmify desativado.');
  }
});
