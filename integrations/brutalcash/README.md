# Integração BrutalCash (PIX) – ativa por padrão

O gateway PIX em uso é a **BrutalCash**. A lógica está no `server.js` (create-pix, webhook-brutalcash, pix-status).

## Configuração (.env)

- `PIX_PROVIDER=brutalcash` (ou omitir; padrão é brutalcash)
- `BRUTALCASH_PUBLIC_KEY=` (painel BrutalCash → Credenciais API)
- `BRUTALCASH_SECRET_KEY=`
- `SITE_URL=` (URL do site, para o postback do webhook)

## Endpoints

- **Criar PIX:** `POST /api/create-pix` (o server escolhe BrutalCash ou Marcha conforme `PIX_PROVIDER`)
- **Webhook:** `POST /api/webhook-brutalcash` – configurar no painel BrutalCash como URL de postback
- **Status:** `GET /api/pix-status/:transactionId`

## Marcha Pay (legado)

Para usar Marcha Pay: `PIX_PROVIDER=marchapay` e preencher `MARCHABB_PUBLIC_KEY` e `MARCHABB_SECRET_KEY`. As duas integrações (BrutalCash e Marcha Pay) ficam instaladas; basta alternar via `PIX_PROVIDER` no `.env`.

## Utmify (trackeamento de vendas)

- `UTMIFY_API_TOKEN=` – token do painel Utmify. Quando configurado, os pedidos (waiting_payment e paid) são enviados ao Utmify.
