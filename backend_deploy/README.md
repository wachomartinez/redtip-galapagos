Instrucciones rápidas para ejecutar el backend

1) Abrir terminal en la carpeta `backend`

2) Instalar dependencias:

   npm install

   Requisito importante: usa Node.js 20 o 22 (LTS). Con Node 24 puede fallar `better-sqlite3` en Windows.

3) Copiar `.env.example` a `.env` y ajustar `JWT_SECRET` si lo deseas.

4) Ejecutar en modo desarrollo (si instalaste nodemon):

   npm run dev

   o simplemente:

   npm start

5) Endpoints:
   POST /api/register  { username, email, password, phone }
   POST /api/login     { email, password }
   GET  /api/me        (Bearer token en Authorization)

Email / SMTP
-----------
Para enviar emails de verificación y notificaciones necesitas configurar SMTP en el archivo `.env` (puedes usar servicios de pruebas como Mailtrap):

  SMTP_HOST=smtp.mailtrap.io
  SMTP_PORT=587
  SMTP_USER=<tu_usuario_mailtrap>
  SMTP_PASS=<tu_contraseña_mailtrap>
  FROM_EMAIL=no-reply@tudominio.com
  ADMIN_EMAIL=admin@tudominio.com

También puedes ajustar `FRONTEND_URL` si tu frontend corre en otra URL (se usa para construir el enlace de verificación).

WhatsApp con IA
---------------
Este backend ahora incluye un webhook para responder mensajes de WhatsApp automaticamente usando IA.

1) Configura estas variables en `.env`:

   OPENAI_API_KEY=<tu_api_key_openai>
   OPENAI_MODEL=gpt-4o-mini
   WHATSAPP_WEBHOOK_TOKEN=<token_opcional_para_seguridad>
   WHATSAPP_SYSTEM_PROMPT=Eres asistente de RedTip Galapagos. Responde de forma corta, amable y clara en espanol.
   WHATSAPP_WEBHOOK_PUBLIC_URL=https://TU_DOMINIO/api/whatsapp/webhook?token=TU_TOKEN
   TWILIO_AUTH_TOKEN=<tu_auth_token_twilio>
   TWILIO_SIGNATURE_VALIDATION=true

2) En Twilio (WhatsApp Sandbox o numero productivo), configura el webhook entrante:

   POST https://TU_DOMINIO/api/whatsapp/webhook?token=TU_TOKEN

   Nota: si no defines `WHATSAPP_WEBHOOK_TOKEN`, puedes omitir `?token=...`.

3) Levanta el backend y prueba enviando un WhatsApp al numero/sandbox conectado.

Endpoint agregado:
   POST /api/whatsapp/webhook

Detalles tecnicos:
- Twilio envia `application/x-www-form-urlencoded` y el servidor ya lo procesa.
- La conversacion por numero se guarda en SQLite (`whatsapp_messages`) para mantener contexto.
- Si no hay `OPENAI_API_KEY`, el webhook responde con un mensaje de configuracion.
- Puedes validar firma de Twilio activando `TWILIO_SIGNATURE_VALIDATION=true`.
- Hay rate limit configurable para el webhook (`WHATSAPP_RATE_LIMIT_WINDOW_MS`, `WHATSAPP_RATE_LIMIT_MAX`).

Seguridad recomendada en produccion
----------------------------------
1) Activa validacion de firma Twilio (`TWILIO_SIGNATURE_VALIDATION=true`).
2) Define `WHATSAPP_WEBHOOK_PUBLIC_URL` con la URL exacta configurada en Twilio.
3) Usa `CORS_ORIGINS` con dominios permitidos separados por comas.
4) Si estas detras de proxy reverso, usa `TRUST_PROXY=true`.
- El bot esta conectado al catalogo real de tours del sitio y responde con enlaces directos.

Catalogo conectado del sitio
---------------------------
Tours enlazados en respuestas de WhatsApp:

- Bartolome (`/tour-bartolome.html`)
- Seymour Norte (`/tour-seymour-norte.html`)
- Islas Plazas (`/tour-plazas.html`)
- Pinzon (`/tour-pinzon.html`)
- Santa Fe (`/tour-santafe.html`)

Configura la base URL publica del sitio en `.env`:

   WHATSAPP_SITE_BASE_URL=https://www.redtipsharkagency.com

Endpoint adicional:
   GET /api/tours/catalog

Reglas de negocio incluidas
---------------------------
Antes de usar IA, el webhook responde con reglas directas para mensajes sobre:

- horarios
- precios/presupuesto
- tours disponibles
- reservas/disponibilidad
- pagos

Ademas, si detecta un tour especifico en el mensaje, responde con enlace directo del tour y pide datos para cotizar (fecha, adultos y ninos).

Escalamiento a humano
---------------------
Si el cliente escribe palabras como "asesor", "agente", "humano", "persona", "llamar" o "contactar":

- el bot responde que pasara con un humano
- marca la conversacion como escalada en la base
- envia email de alerta al admin (`ADMIN_EMAIL`) si SMTP esta configurado

Plantillas de email
-------------------
Las plantillas HTML y de texto se encuentran en `backend/emails` y se usan automáticamente al enviar correos:

- `verification.html` / `verification.txt` (verificación de cuenta)
- `order_confirmation.html` / `order_confirmation.txt` (confirmación al usuario)
- `admin_notification.txt` (notificación al admin)

En desarrollo el servidor devolverá `verificationUrl` en la respuesta de registro para facilitar pruebas.

Nota: por simplicidad el servidor usa SQLite (`database.sqlite`) dentro de la carpeta `backend`. Si quieres usar Postgres o MySQL luego, lo migramos.

Solucion rapida si `npm install` falla en Windows
-----------------------------------------------
Si ves errores de compilacion de `better-sqlite3` con Node 24:

1) Cambia a Node 22 LTS (recomendado) o Node 20 LTS.
2) Borra `node_modules` y `package-lock.json` dentro de `backend`.
3) Ejecuta nuevamente `npm install`.