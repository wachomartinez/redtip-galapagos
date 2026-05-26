require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const OpenAI = require('openai');
const twilio = require('twilio');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new Database(DB_PATH);

// Crear tabla users si no existe
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    phone TEXT,
    email_verified INTEGER DEFAULT 0,
    verification_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Migración ligera: columnas para recuperación de contraseña
try { db.prepare('ALTER TABLE users ADD COLUMN reset_password_token TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE users ADD COLUMN reset_password_expires_at DATETIME').run(); } catch (e) {}

// Tabla restaurants
db.prepare(`
  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    nombre TEXT NOT NULL,
    categoria TEXT,
    imagen_url TEXT,
    descripcion TEXT,
    direccion TEXT,
    telefono TEXT,
    apertura TEXT,
    cierre TEXT,
    owner_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Tabla orders
db.prepare(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    items TEXT,
    total REAL,
    status TEXT DEFAULT 'pending',
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

const app = express();
// Servir archivos estáticos (front-end) desde la carpeta padre (raíz del proyecto)
app.use(express.static(path.join(__dirname, '..')));
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
if (TRUST_PROXY) app.set('trust proxy', 1);
app.use(cors({
  origin(origin, callback){
    if(!origin) return callback(null, true);
    if(CORS_ORIGINS.length === 0) return callback(null, true);
    if(CORS_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS'));
  }
}));
const BODY_LIMIT = process.env.BODY_LIMIT || '25mb';
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: BODY_LIMIT }));

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

function generateToken(user){
  return jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function genRandomToken(){
  return crypto.randomBytes(24).toString('hex');
}

// Configuración SMTP y helpers de email
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@example.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const WHATSAPP_WEBHOOK_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || '';
const WHATSAPP_SYSTEM_PROMPT = process.env.WHATSAPP_SYSTEM_PROMPT || 'Eres asistente de RedTip Galapagos. Responde de forma corta, amable y clara en espanol. Si no sabes algo, dilo y ofrece pasar con un humano.';
const WHATSAPP_BUSINESS_NAME = process.env.WHATSAPP_BUSINESS_NAME || 'RedTip Galapagos';
const WHATSAPP_SITE_BASE_URL = (process.env.WHATSAPP_SITE_BASE_URL || 'https://www.redtipsharkagency.com').replace(/\/$/, '');
const WHATSAPP_WEBHOOK_PUBLIC_URL = process.env.WHATSAPP_WEBHOOK_PUBLIC_URL || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_SIGNATURE_VALIDATION = process.env.TWILIO_SIGNATURE_VALIDATION === 'true';
const WHATSAPP_RATE_LIMIT_WINDOW_MS = Number(process.env.WHATSAPP_RATE_LIMIT_WINDOW_MS || 60000);
const WHATSAPP_RATE_LIMIT_MAX = Number(process.env.WHATSAPP_RATE_LIMIT_MAX || 20);

const whatsappRateLimitMap = new Map();

const openaiClient = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const TOUR_CATALOG = [
  {
    id: 'bartolome',
    name: 'Isla Bartolome',
    urlPath: '/tour-bartolome.html',
    type: 'caminata',
    duration: 'dia completo',
    aliases: ['bartolome', 'bartolomee', 'isla bartolome']
  },
  {
    id: 'seymour-norte',
    name: 'Seymour Norte',
    urlPath: '/tour-seymour-norte.html',
    type: 'caminata y observacion de fauna',
    duration: 'dia completo',
    aliases: ['seymour', 'seymour norte', 'north seymour']
  },
  {
    id: 'plazas',
    name: 'Islas Plazas',
    urlPath: '/tour-plazas.html',
    type: 'caminata y snorkel',
    duration: 'dia completo',
    aliases: ['plazas', 'islas plazas', 'plaza islands']
  },
  {
    id: 'pinzon',
    name: 'Isla Pinzon',
    urlPath: '/tour-pinzon.html',
    type: 'snorkeling',
    duration: 'dia completo',
    aliases: ['pinzon', 'isla pinzon']
  },
  {
    id: 'santafe',
    name: 'Isla Santa Fe',
    urlPath: '/tour-santafe.html',
    type: 'snorkeling',
    duration: 'dia completo',
    aliases: ['santa fe', 'santafe', 'isla santa fe']
  }
];

db.prepare(`
  CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wa_from TEXT,
    direction TEXT,
    message TEXT,
    escalated INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

function escapeXml(unsafe = '') {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createTwimlMessage(text) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(text)}</Message></Response>`;
}

function normalizeWhatsappFrom(from) {
  return (from || '').toLowerCase().replace(/^whatsapp:/, '').trim();
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
}

function isRateLimited(key) {
  const now = Date.now();
  const current = whatsappRateLimitMap.get(key);
  if (!current || now > current.resetAt) {
    whatsappRateLimitMap.set(key, { count: 1, resetAt: now + WHATSAPP_RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  if (current.count > WHATSAPP_RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

function getTwilioValidationUrl(req) {
  if (WHATSAPP_WEBHOOK_PUBLIC_URL) return WHATSAPP_WEBHOOK_PUBLIC_URL;
  return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

function isValidTwilioRequest(req) {
  if (!TWILIO_SIGNATURE_VALIDATION) return true;
  if (!TWILIO_AUTH_TOKEN) return false;
  const signature = req.headers['x-twilio-signature'];
  if (!signature) return false;
  const url = getTwilioValidationUrl(req);
  return twilio.validateRequest(TWILIO_AUTH_TOKEN, String(signature), url, req.body);
}

function saveWhatsappMessage(from, direction, message, escalated = 0) {
  db.prepare('INSERT INTO whatsapp_messages (wa_from, direction, message, escalated) VALUES (?, ?, ?, ?)').run(normalizeWhatsappFrom(from), direction, message, escalated ? 1 : 0);
}

function getRecentWhatsappMessages(from, limit = 12) {
  const rows = db.prepare('SELECT direction, message FROM whatsapp_messages WHERE wa_from = ? ORDER BY id DESC LIMIT ?').all(normalizeWhatsappFrom(from), limit);
  return rows.reverse().map((row) => ({
    role: row.direction === 'in' ? 'user' : 'assistant',
    content: row.message
  }));
}

function normalizeText(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findMentionedTours(incomingText) {
  const normalized = normalizeText(incomingText);
  return TOUR_CATALOG.filter((tour) => tour.aliases.some((alias) => normalized.includes(alias)));
}

function tourAbsoluteUrl(tour) {
  return `${WHATSAPP_SITE_BASE_URL}${tour.urlPath}`;
}

function getRuleBasedReply(incomingText) {
  const text = normalizeText(incomingText || '');
  const matchedTours = findMentionedTours(incomingText);
  const asksPrice = /precio|cuanto|costo|valor|tarifa|presupuesto/.test(text);
  const asksAvailability = /reserva|reservar|booking|cupo|disponibilidad|disponible/.test(text);

  if (/asesor|agente|humano|persona|llamar|contactar/.test(text)) {
    return {
      escalated: true,
      message: 'Claro, te paso con un asesor humano de RedTip Galapagos. En breve te escribimos por este medio.'
    };
  }

  if (/horario|hora|abren|abierto|atencion/.test(text)) {
    return {
      escalated: false,
      message: 'Nuestro horario de atencion es de 08:00 a 20:00 (hora Galapagos). Si quieres, te ayudo a elegir un tour ahora mismo.'
    };
  }

  if ((asksPrice || asksAvailability) && matchedTours.length === 1) {
    const tour = matchedTours[0];
    return {
      escalated: false,
      message: `Perfecto, te ayudo con ${tour.name}. Es un tour de ${tour.type} (${tour.duration}). Mira el detalle aqui: ${tourAbsoluteUrl(tour)}. Para cotizar y revisar cupos enviame fecha, adultos y ninos.`
    };
  }

  if (matchedTours.length === 1) {
    const tour = matchedTours[0];
    return {
      escalated: false,
      message: `Excelente eleccion: ${tour.name}. Puedes ver itinerario y detalles aqui: ${tourAbsoluteUrl(tour)}. Si deseas, te reviso disponibilidad por fecha.`
    };
  }

  if (asksPrice) {
    return {
      escalated: false,
      message: 'Te ayudamos con precios segun tour, fecha y numero de personas. Enviame: 1) tour de interes, 2) fecha, 3) adultos y ninos. Tours: Bartolome, Seymour Norte, Islas Plazas, Pinzon y Santa Fe.'
    };
  }

  if (/tour|tours|excursion|bartolome|pinzon|plazas|santafe|santa fe|seymour/.test(text)) {
    const list = TOUR_CATALOG.map((tour) => `${tour.name}: ${tourAbsoluteUrl(tour)}`).join(' | ');
    return {
      escalated: false,
      message: `Tenemos tours diarios y de snorkeling en Galapagos. Opciones disponibles: ${list}. Dime cual te interesa y te paso disponibilidad.`
    };
  }

  if (asksAvailability) {
    return {
      escalated: false,
      message: 'Para reservar te pido: tour, fecha, numero de personas y nombres completos. Con eso revisamos disponibilidad y te guiamos en el pago.'
    };
  }

  if (/pago|transferencia|tarjeta|deposito|abono/.test(text)) {
    return {
      escalated: false,
      message: 'Aceptamos distintos metodos de pago segun el tour. Comparte tu tour y fecha para indicarte la opcion exacta y asegurar tu reserva.'
    };
  }

  return null;
}

async function notifyAdminWhatsappEscalation(from, incomingText) {
  try {
    const subject = `Escalacion WhatsApp - ${WHATSAPP_BUSINESS_NAME}`;
    const text = `Se solicito atencion humana en WhatsApp.\nNumero: ${normalizeWhatsappFrom(from)}\nMensaje: ${incomingText}`;
    await sendMail({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject, text });
  } catch (err) {
    console.error('No se pudo notificar escalacion WhatsApp al admin:', err);
  }
}

async function buildWhatsappAiReply(from, incomingText) {
  const history = getRecentWhatsappMessages(from, 12);
  const messages = [
    { role: 'system', content: WHATSAPP_SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: incomingText }
  ];

  const completion = await openaiClient.chat.completions.create({
    model: OPENAI_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: 300
  });

  const reply = completion.choices?.[0]?.message?.content?.trim() || 'Gracias por escribirnos. En un momento te ayudamos con tu consulta.';
  return reply;
}

let transporter = null;
if(SMTP_HOST && SMTP_USER){
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465, // true si usa 465
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
} else {
  console.log('Warning: SMTP no configurado. Los emails no serán enviados.');
}

async function sendMail(opts){
  if(!transporter){ console.log('SMTP no configurado. Saltando email a', opts && opts.to); return; }
  return transporter.sendMail(opts);
}

const fs = require('fs');
const EMAIL_TEMPLATES_DIR = path.join(__dirname, 'emails');
function loadTemplate(name){ try{ return fs.readFileSync(path.join(EMAIL_TEMPLATES_DIR, name), 'utf8'); }catch(e){ return null; } }
function renderTemplate(tpl, data){ if(!tpl) return null; return tpl.replace(/\{\{(\w+)\}\}/g, (m,k)=> (data && (data[k] !== undefined && data[k] !== null) ? data[k] : '')); }

async function sendVerificationEmail(user, token){
  const verifyUrl = `${FRONTEND_URL}/api/verify?token=${token}`;
  const tplHtml = loadTemplate('verification.html');
  const tplText = loadTemplate('verification.txt');
  const html = tplHtml ? renderTemplate(tplHtml, { username: user.username, verifyUrl }) : `<p>Hola ${user.username},</p><p>Verifica: <a href="${verifyUrl}">${verifyUrl}</a></p>`;
  const text = tplText ? renderTemplate(tplText, { username: user.username, verifyUrl }) : `Verifica tu correo: ${verifyUrl}`;
  try{ await sendMail({ from: FROM_EMAIL, to: user.email, subject: 'Verificación de correo - RedTip', text, html }); }catch(err){ console.error('Error enviando email de verificación:', err); }
}

async function sendPasswordResetEmail(user, token){
  const resetUrl = `${FRONTEND_URL}/reset-password.html?token=${token}`;
  const html = `<p>Hola ${user.username || 'usuario'},</p><p>Recibimos una solicitud para cambiar tu contraseña.</p><p><a href="${resetUrl}">Haz clic aquí para crear una nueva contraseña</a></p><p>Este enlace vence en 1 hora.</p>`;
  const text = `Hola ${user.username || 'usuario'},\n\nRecibimos una solicitud para cambiar tu contraseña.\nAbre este enlace: ${resetUrl}\n\nEste enlace vence en 1 hora.`;
  try {
    await sendMail({
      from: FROM_EMAIL,
      to: user.email,
      subject: 'Recuperar contraseña - RedTip',
      text,
      html
    });
  } catch (err) {
    console.error('Error enviando email de recuperación:', err);
  }
}

async function sendOrderEmails(order){
  try{
    const user = db.prepare('SELECT username, email FROM users WHERE id = ?').get(order.user_id);
    const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items);
    const itemsText = items.map(i=>`${i.qty} x ${i.restaurantName} - ${i.detail} - $${Number(i.price).toFixed(2)}`).join('\n');
    const itemsHtml = '<ul>' + items.map(i=>`<li>${i.qty} x ${i.restaurantName} - ${i.detail} - $${Number(i.price).toFixed(2)}</li>`).join('') + '</ul>';

    const tplHtml = loadTemplate('order_confirmation.html');
    const tplText = loadTemplate('order_confirmation.txt');
    const adminTpl = loadTemplate('admin_notification.txt');

    const htmlUser = tplHtml ? renderTemplate(tplHtml, { username: user.username, orderId: order.id, itemsHtml, total: Number(order.total).toFixed(2) }) : `<p>Hola ${user.username},</p><p>Tu pedido #${order.id} ha sido recibido.</p><pre>${itemsText}</pre><p>Total: $${Number(order.total).toFixed(2)}</p>`;
    const textUser = tplText ? renderTemplate(tplText, { username: user.username, orderId: order.id, itemsText, total: Number(order.total).toFixed(2) }) : `Hola ${user.username},\nTu pedido #${order.id} ha sido recibido.\n${itemsText}\nTotal: $${Number(order.total).toFixed(2)}`;

    await sendMail({ from: FROM_EMAIL, to: user.email, subject: `Confirmación pedido #${order.id}`, text: textUser, html: htmlUser });

    // Notificación al admin
    const adminText = adminTpl ? renderTemplate(adminTpl, { orderId: order.id, username: user.username, email: user.email, itemsText, total: Number(order.total).toFixed(2) }) : `Nuevo pedido #${order.id}\nUsuario: ${user.username} (${user.email})\n${itemsText}\nTotal: $${Number(order.total).toFixed(2)}`;
    await sendMail({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject: `Nuevo pedido #${order.id}`, text: adminText });
  }catch(err){ console.error('Error en envío de emails de pedido:', err); }
}

// Middleware de autenticación JWT
function requireAuth(req, res, next){
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if(!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch(e) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Endpoint: listar restaurantes (DB + estáticos de ejemplo)
app.get('/api/restaurants', (req,res)=>{
  const rows = db.prepare('SELECT * FROM restaurants ORDER BY created_at DESC').all();
  res.json({ restaurants: rows });
});

// Endpoint: restaurantes del usuario autenticado
app.get('/api/my-restaurants', requireAuth, (req,res)=>{
  const rows = db.prepare('SELECT * FROM restaurants WHERE owner_user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ restaurants: rows });
});

// Endpoint: obtener restaurante por slug
app.get('/api/restaurants/:slug', (req,res)=>{
  const row = db.prepare('SELECT * FROM restaurants WHERE slug = ?').get(req.params.slug);
  if(!row) return res.status(404).json({ error: 'No encontrado' });
  res.json({ restaurant: row });
});

// Endpoint: crear restaurante (requiere login)
app.post('/api/restaurants', requireAuth, (req,res)=>{
  try{
    const { nombre, categoria, imagen_url, descripcion, direccion, telefono, apertura, cierre } = req.body;
    if(!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
    // generar slug único a partir del nombre
    let base = nombre.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    let slug = base;
    let counter = 1;
    while(db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(slug)){
      slug = base + '-' + counter++;
    }
    const info = db.prepare(
      'INSERT INTO restaurants (slug,nombre,categoria,imagen_url,descripcion,direccion,telefono,apertura,cierre,owner_user_id) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(slug, nombre, categoria||null, imagen_url||null, descripcion||null, direccion||null, telefono||null, apertura||null, cierre||null, req.user.id);
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ok: true, restaurant });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Endpoint: eliminar restaurante por slug (solo el propietario)
app.delete('/api/restaurants/:slug', requireAuth, (req,res)=>{
  try{
    const slug = String(req.params.slug || '').trim();
    if(!slug) return res.status(400).json({ error: 'Slug inválido' });

    const row = db.prepare('SELECT id, owner_user_id FROM restaurants WHERE slug = ?').get(slug);
    if(!row) return res.status(404).json({ error: 'No encontrado' });

    if(Number(row.owner_user_id || 0) !== Number(req.user.id || 0)){
      return res.status(403).json({ error: 'No tienes permisos para eliminar este restaurante' });
    }

    db.prepare('DELETE FROM restaurants WHERE id = ?').run(row.id);
    res.json({ ok: true });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Registro con token de verificación
app.post('/api/register', async (req, res) => {
  try{
    const { username, email, password, phone } = req.body;
    if(!username || !email || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });

    // Verificar usuario/email existente
    const exists = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if(exists) return res.status(409).json({ error: 'Email o usuario ya registrado' });

    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    const token = genRandomToken();

    const info = db.prepare('INSERT INTO users (username, email, password_hash, phone, verification_token) VALUES (?, ?, ?, ?, ?)').run(username, email, hash, phone || null, token);
    const user = db.prepare('SELECT id, username, email, phone, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);

    // Para desarrollo devolvemos la url de verificación en la respuesta (en producción envía por email)
    const verificationUrl = `/api/verify?token=${token}`;
    // Enviar email de verificación (no bloquear la respuesta)
    sendVerificationEmail(user, token).catch(err=>console.error('Error enviando verificación:', err));

    return res.status(201).json({ user, verificationUrl });
  }catch(err){
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Verificación de email
app.get('/api/verify', (req,res)=>{
  const token = req.query.token;
  if(!token) return res.status(400).send('Token requerido');
  const user = db.prepare('SELECT id FROM users WHERE verification_token = ?').get(token);
  if(!user) return res.status(400).send('Token inválido');
  db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?').run(user.id);
  res.send('Correo verificado. Ya puedes iniciar sesión.');
});

// Solicitar recuperación de contraseña
app.post('/api/forgot-password', async (req, res) => {
  try {
    const email = (req.body && req.body.email ? String(req.body.email) : '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email requerido' });
    }
    const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const smtpReady = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

if (isProduction && !smtpReady) {
  console.error('SMTP no configurado en production (faltan SMTP_HOST/SMTP_USER/SMTP_PASS)');
  return res.status(500).json({ error: 'Servicio de correo no configurado. Contacta al administrador.' });
}

    const user = db.prepare('SELECT id, username, email FROM users WHERE lower(email) = ?').get(email);
    if (!user) {
      return res.json({ ok: true, message: 'Si el email existe, enviamos un enlace de recuperación.' });
    }

    const token = genRandomToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE users SET reset_password_token = ?, reset_password_expires_at = ? WHERE id = ?').run(token, expiresAt, user.id);

    await sendPasswordResetEmail(user, token);
    return res.json({ ok: true, message: 'Si el email existe, enviamos un enlace de recuperación.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Restablecer contraseña con token
app.post('/api/reset-password', async (req, res) => {
  try {
    const token = (req.body && req.body.token ? String(req.body.token) : '').trim();
    const password = (req.body && req.body.password ? String(req.body.password) : '').trim();
    if (!token || !password) {
      return res.status(400).json({ error: 'Token y contraseña requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const user = db.prepare('SELECT id, reset_password_expires_at FROM users WHERE reset_password_token = ?').get(token);
    if (!user) {
      return res.status(400).json({ error: 'Token inválido' });
    }

    if (!user.reset_password_expires_at || new Date(user.reset_password_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Token expirado' });
    }

    const hash = await bcrypt.hash(password, 10);
    db.prepare('UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expires_at = NULL WHERE id = ?').run(hash, user.id);
    return res.json({ ok: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try{
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({ error: 'Faltan campos' });

    const user = db.prepare('SELECT id, username, email, password_hash, email_verified FROM users WHERE email = ?').get(email);
    if(!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if(!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = generateToken(user);
    return res.json({ token, user: { id: user.id, username: user.username, email: user.email, email_verified: user.email_verified } });
  }catch(err){
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Middleware de autenticación
function authMiddleware(req,res,next){
  const auth = req.headers.authorization;
  if(!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  const token = auth.split(' ')[1];
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  }catch(err){
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Obtener perfil
app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, email, phone, email_verified, created_at FROM users WHERE id = ?').get(req.user.id);
  return res.json({ user });
});

// Crear pedido (protegido)
app.post('/api/orders', authMiddleware, (req,res)=>{
  try{
    const { items, total, address } = req.body;
    if(!items || typeof total !== 'number') return res.status(400).json({ error: 'Campos inválidos' });
    const info = db.prepare('INSERT INTO orders (user_id, items, total, address) VALUES (?, ?, ?, ?)').run(req.user.id, JSON.stringify(items), total, address || null);
    const orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
    const order = { ...orderRow, items: JSON.parse(orderRow.items) };
    // Enviar emails de confirmación y notificación (async)
    sendOrderEmails(order).catch(err=>console.error('Error enviando emails de pedido:', err));
    return res.status(201).json({ order });
  }catch(err){ console.error(err); return res.status(500).json({ error: 'Error interno' }); }
});

// Listar pedidos del usuario
app.get('/api/orders', authMiddleware, (req,res)=>{
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const orders = rows.map(r=>({ ...r, items: JSON.parse(r.items) }));
  res.json({ orders });
});

// Catalogo de tours conectados al sitio para chatbot/API
app.get('/api/tours/catalog', (req, res) => {
  const tours = TOUR_CATALOG.map((tour) => ({
    id: tour.id,
    name: tour.name,
    type: tour.type,
    duration: tour.duration,
    url: tourAbsoluteUrl(tour)
  }));
  res.json({ tours });
});

// Webhook de WhatsApp (Twilio) con respuesta IA
app.post('/api/whatsapp/webhook', async (req, res) => {
  try {
    if (WHATSAPP_WEBHOOK_TOKEN) {
      const token = req.query.token;
      if (token !== WHATSAPP_WEBHOOK_TOKEN) {
        return res.status(403).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }
    }

    const from = req.body.From || '';
    const body = (req.body.Body || '').trim();
    const clientIp = getClientIp(req) || 'unknown';

    if (!isValidTwilioRequest(req)) {
      return res.status(403).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    if (isRateLimited(`${normalizeWhatsappFrom(from)}|${clientIp}`)) {
      return res.status(429).type('text/xml').send(createTwimlMessage('Estamos recibiendo muchos mensajes seguidos. Intenta nuevamente en un momento.'));
    }

    if (!from || !body) {
      return res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    if (body.length > 2000) {
      return res.type('text/xml').send(createTwimlMessage('Tu mensaje es muy largo. Enviame un resumen corto y te ayudo enseguida.'));
    }

    saveWhatsappMessage(from, 'in', body, 0);

    const ruleReply = getRuleBasedReply(body);
    if (ruleReply) {
      if (ruleReply.escalated) {
        saveWhatsappMessage(from, 'out', ruleReply.message, 1);
        notifyAdminWhatsappEscalation(from, body).catch((err) => console.error('Error notificando escalacion:', err));
      } else {
        saveWhatsappMessage(from, 'out', ruleReply.message, 0);
      }
      return res.type('text/xml').send(createTwimlMessage(ruleReply.message));
    }

    if (!openaiClient) {
      const fallback = 'Gracias por escribirnos. Nuestro bot esta en configuracion. Te atendemos pronto.';
      saveWhatsappMessage(from, 'out', fallback, 0);
      return res.type('text/xml').send(createTwimlMessage(fallback));
    }

    const aiReply = await buildWhatsappAiReply(from, body);
    saveWhatsappMessage(from, 'out', aiReply, 0);
    return res.type('text/xml').send(createTwimlMessage(aiReply));
  } catch (err) {
    console.error('Error webhook WhatsApp:', err);
    return res.type('text/xml').send(createTwimlMessage('Ocurrio un problema temporal. Intenta nuevamente en unos minutos.'));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
  console.log(`API escuchando en http://localhost:${PORT}`);
});
