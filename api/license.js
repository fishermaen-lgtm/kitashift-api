// KitaShift·KI — License API v3.0 (Persistent Keys via GitHub)
// Keys werden als JSON in GitHub gespeichert → gehen NIE verloren
// © 2026 BDS Bieler Distribution Service

const nodemailer = require('nodemailer');

// ─── CONFIG ───
const GITHUB_OWNER = 'fishermaen-lgtm';
const GITHUB_REPO = 'kitashift-api';
const GITHUB_FILE = 'data/keys.json';
// GITHUB_TOKEN → als Vercel Environment Variable setzen!

// ─── In-Memory Cache (beschleunigt Validierung) ───
let keysCache = null;
let cacheTime = 0;
const CACHE_TTL = 30000; // 30 Sekunden Cache

// ─── GitHub Datei lesen ───
async function loadKeysFromGitHub() {
  // Cache prüfen
  if (keysCache && (Date.now() - cacheTime) < CACHE_TTL) {
    return keysCache;
  }

  var token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('[LICENSE] GITHUB_TOKEN nicht gesetzt!');
    return keysCache || {};
  }

  try {
    var resp = await fetch('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + GITHUB_FILE, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'KitaShift-License-API'
      }
    });

    if (resp.status === 404) {
      // Datei existiert noch nicht → leeres Objekt
      keysCache = {};
      cacheTime = Date.now();
      return keysCache;
    }

    if (!resp.ok) {
      console.error('[LICENSE] GitHub read failed:', resp.status);
      return keysCache || {};
    }

    var data = await resp.json();
    var content = Buffer.from(data.content, 'base64').toString('utf8');
    keysCache = JSON.parse(content);
    keysCache._sha = data.sha; // SHA merken für Updates
    cacheTime = Date.now();
    return keysCache;
  } catch (err) {
    console.error('[LICENSE] GitHub read error:', err.message);
    return keysCache || {};
  }
}

// ─── GitHub Datei schreiben ───
async function saveKeysToGitHub(keys) {
  var token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('[LICENSE] GITHUB_TOKEN nicht gesetzt!');
    return false;
  }

  // SHA der aktuellen Datei holen (nötig für Updates)
  var sha = keys._sha || null;
  var cleanKeys = Object.assign({}, keys);
  delete cleanKeys._sha;

  var content = Buffer.from(JSON.stringify(cleanKeys, null, 2)).toString('base64');

  var body = {
    message: 'License key update: ' + new Date().toISOString(),
    content: content
  };
  if (sha) body.sha = sha;

  try {
    var resp = await fetch('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + GITHUB_FILE, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'KitaShift-License-API',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      var errText = await resp.text();
      console.error('[LICENSE] GitHub write failed:', resp.status, errText);
      return false;
    }

    var result = await resp.json();
    // Neuen SHA merken
    keysCache = keys;
    keysCache._sha = result.content.sha;
    cacheTime = Date.now();
    console.log('[LICENSE] Keys saved to GitHub successfully');
    return true;
  } catch (err) {
    console.error('[LICENSE] GitHub write error:', err.message);
    return false;
  }
}

// ─── Key Generator ───
function generateKey(plan) {
  var prefix = plan === 'traeger' ? 'TRG' : 'PRO';
  var year = new Date().getFullYear();
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var p1 = '', p2 = '';
  for (var i = 0; i < 4; i++) {
    p1 += chars[Math.floor(Math.random() * chars.length)];
    p2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix + '-' + year + '-' + p1 + '-' + p2;
}

// ─── Plan aus PayPal Betrag ermitteln ───
function getPlanFromAmount(amount) {
  var a = parseFloat(amount);
  if (a <= 0) return null;
  if (a >= 25) return 'traeger';
  return 'pro';
}

function getMonthsFromAmount(amount) {
  var a = parseFloat(amount);
  if (a >= 89) return 12; // Jahresabos
  return 1;
}

// ─── E-Mail senden ───
async function sendLicenseEmail(toEmail, customerName, licenseKey, plan, validUntil) {
  var transporter = nodemailer.createTransport({
    host: 'smtp.strato.de',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'info@save-house.de',
      pass: process.env.SMTP_PASS || ''
    }
  });

  var planName = plan === 'traeger' ? 'Träger-Lizenz' : 'Pro-Lizenz';

  var htmlBody = '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">'
    + '<div style="background:#1a3a5c;color:white;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center;">'
    + '<h1 style="margin:0;font-size:1.5rem;">KitaShift KI</h1>'
    + '<p style="margin:4px 0 0;opacity:.8;font-size:.9rem;">Ihr Lizenzkey ist bereit!</p>'
    + '</div>'
    + '<div style="background:#f8fafc;border:1px solid #d1dbe8;border-top:none;padding:24px;border-radius:0 0 12px 12px;">'
    + '<p>Hallo ' + (customerName || 'Kunde') + ',</p>'
    + '<p>vielen Dank fuer Ihren Kauf der <strong>' + planName + '</strong>!</p>'
    + '<div style="background:white;border:2px solid #1a3a5c;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">'
    + '<div style="font-size:.8rem;color:#64748b;margin-bottom:8px;">Ihr Lizenzkey:</div>'
    + '<div style="font-size:1.8rem;font-weight:900;font-family:monospace;letter-spacing:.15em;color:#1a3a5c;">' + licenseKey + '</div>'
    + '<div style="font-size:.78rem;color:#64748b;margin-top:8px;">Gueltig bis: ' + validUntil + '</div>'
    + '</div>'
    + '<h3 style="color:#1a3a5c;">So aktivieren Sie Ihre Lizenz:</h3>'
    + '<ol style="line-height:1.8;">'
    + '<li>Oeffnen Sie <a href="https://kitaplan.save-house.de/app.html">kitaplan.save-house.de/app.html</a></li>'
    + '<li>Klicken Sie oben auf den <strong>Free</strong> Button</li>'
    + '<li>Geben Sie Ihren Lizenzkey ein: <code style="background:#e8f4fd;padding:2px 8px;border-radius:4px;">' + licenseKey + '</code></li>'
    + '<li>Klicken Sie auf <strong>Lizenz aktivieren</strong></li>'
    + '</ol>'
    + '<p>Bei Fragen antworten Sie einfach auf diese E-Mail.</p>'
    + '<p>Mit freundlichen Gruessen,<br/><strong>Matthias Bieler</strong><br/>BDS Bieler Distribution Service<br/>'
    + '<a href="https://kitaplan.save-house.de">kitaplan.save-house.de</a></p>'
    + '</div></body></html>';

  return transporter.sendMail({
    from: '"KitaShift KI" <' + (process.env.SMTP_USER || 'info@save-house.de') + '>',
    to: toEmail,
    subject: 'Ihr KitaShift KI Lizenzkey - ' + planName,
    html: htmlBody
  });
}

// ═══════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════
module.exports = async function (req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET = Status
  if (req.method !== 'POST') {
    var keys = await loadKeysFromGitHub();
    var count = Object.keys(keys).filter(function(k) { return k !== '_sha'; }).length;
    return res.json({ service: 'KitaShift KI License API', status: 'online', version: '3.0', storage: 'GitHub persistent', totalKeys: count });
  }

  var body = req.body || {};

  // ═══════════════════════════════════════
  // 1. LIZENZ VALIDIEREN
  // ═══════════════════════════════════════
  if (body.action === 'validate') {
    if (!body.key) return res.status(400).json({ valid: false, error: 'Kein Key' });

    var keys = await loadKeysFromGitHub();
    var k = body.key.toUpperCase().trim();
    var license = keys[k];

    if (!license) return res.json({ valid: false, error: 'Ungueltiger Lizenzkey' });

    // Abgelaufen?
    if (license.validUntil && new Date(license.validUntil) < new Date()) {
      return res.json({ valid: false, error: 'Lizenz abgelaufen', expired: true });
    }

    // Bereits aktiviert? Dann nur gleiche E-Mail erlauben (Schutz gegen Weitergabe)
    if (license.activatedAt && license.activatedDevice && body.deviceId && license.activatedDevice !== body.deviceId) {
      // Key wurde schon auf einem anderen Gerät aktiviert
      // Für jetzt: trotzdem erlauben (Multi-Device), aber loggen
      console.log('[LICENSE] Key', k, 'used on different device. Original:', license.activatedDevice, 'New:', body.deviceId);
    }

    // Erste Aktivierung markieren
    if (!license.activatedAt) {
      license.activatedAt = new Date().toISOString();
      keys[k] = license;
      await saveKeysToGitHub(keys);
      console.log('[LICENSE] Key first activation:', k);
    }

    return res.json({
      valid: true, plan: license.plan, maxMA: license.maxMA,
      validUntil: license.validUntil,
      features: { excelImport: true, twoWeeks: true, datev: true, apiKey: true, dragDrop: true, pdfClean: true }
    });
  }

  // ═══════════════════════════════════════
  // 2. KEY MANUELL GENERIEREN + EMAIL
  // ═══════════════════════════════════════
  if (body.action === 'manual-generate') {
    var ADMIN_SECRET = process.env.ADMIN_SECRET || 'kitashift-admin-2026';
    if (body.secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });
    if (!body.email) return res.status(400).json({ error: 'E-Mail fehlt' });

    var keys = await loadKeysFromGitHub();
    var plan = body.plan || 'pro';
    var months = body.months || 12;
    var key = generateKey(plan);

    // Sicherstellen dass Key einzigartig ist
    while (keys[key]) {
      key = generateKey(plan);
    }

    var validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + months);
    var validStr = validUntil.toISOString().substring(0, 10);

    // Key persistent speichern
    keys[key] = {
      plan: plan,
      email: body.email,
      validUntil: validStr,
      maxMA: plan === 'traeger' ? 999 : 20,
      createdAt: new Date().toISOString(),
      source: 'manual',
      activatedAt: null
    };

    var saved = await saveKeysToGitHub(keys);
    if (!saved) {
      return res.status(500).json({ error: 'Key konnte nicht gespeichert werden. Bitte GITHUB_TOKEN pruefen.' });
    }

    // E-Mail senden
    try {
      await sendLicenseEmail(body.email, body.name || '', key, plan, validStr);
      console.log('[MANUAL] Key generated, saved, and emailed:', key, '->', body.email);
      return res.json({ success: true, key: key, plan: plan, email: body.email, validUntil: validStr, persisted: true });
    } catch (emailErr) {
      console.error('[MANUAL] Email failed:', emailErr.message);
      return res.json({ success: true, key: key, plan: plan, email: body.email, validUntil: validStr, persisted: true, warning: 'Key gespeichert, aber E-Mail fehlgeschlagen: ' + emailErr.message });
    }
  }

  // ═══════════════════════════════════════
  // 3. KEY NUR GENERIEREN (ohne Email)
  // ═══════════════════════════════════════
  if (body.action === 'generate') {
    var ADMIN_SECRET = process.env.ADMIN_SECRET || 'kitashift-admin-2026';
    if (body.secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

    var keys = await loadKeysFromGitHub();
    var plan = body.plan || 'pro';
    var months = body.months || 12;
    var key = generateKey(plan);
    while (keys[key]) key = generateKey(plan);

    var validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + months);
    var validStr = validUntil.toISOString().substring(0, 10);

    keys[key] = {
      plan: plan,
      email: body.email || '',
      validUntil: validStr,
      maxMA: plan === 'traeger' ? 999 : 20,
      createdAt: new Date().toISOString(),
      source: 'generate',
      activatedAt: null
    };

    var saved = await saveKeysToGitHub(keys);
    return res.json({ key: key, plan: plan, validUntil: validStr, persisted: saved });
  }

  // ═══════════════════════════════════════
  // 4. PAYPAL WEBHOOK
  // ═══════════════════════════════════════
  if (body.event_type === 'PAYMENT.CAPTURE.COMPLETED' || body.event_type === 'CHECKOUT.ORDER.APPROVED') {
    console.log('[PAYPAL] Event:', body.event_type);

    var resource = body.resource || {};
    var payer = resource.payer || {};
    var payerEmail = payer.email_address || '';
    var payerName = (payer.name || {}).given_name || '';
    var amount = '0';
    if (resource.amount) amount = resource.amount.value || '0';
    else if (resource.purchase_units && resource.purchase_units[0]) amount = (resource.purchase_units[0].amount || {}).value || '0';

    console.log('[PAYPAL] Payer:', payerEmail, 'Amount:', amount);
    if (!payerEmail) return res.status(200).json({ received: true, error: 'No email' });

    var plan = getPlanFromAmount(amount);
    if (!plan) return res.status(200).json({ received: true, plan: 'free' });

    var keys = await loadKeysFromGitHub();
    var months = getMonthsFromAmount(amount);
    var key = generateKey(plan);
    while (keys[key]) key = generateKey(plan);

    var validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + months);
    var validStr = validUntil.toISOString().substring(0, 10);

    keys[key] = {
      plan: plan,
      email: payerEmail,
      validUntil: validStr,
      maxMA: plan === 'traeger' ? 999 : 20,
      createdAt: new Date().toISOString(),
      source: 'paypal-webhook',
      paypalAmount: amount,
      activatedAt: null
    };

    var saved = await saveKeysToGitHub(keys);
    console.log('[PAYPAL] Key:', key, 'Saved:', saved);

    try {
      await sendLicenseEmail(payerEmail, payerName, key, plan, validStr);
      console.log('[PAYPAL] Email sent to', payerEmail);
    } catch (emailErr) {
      console.error('[PAYPAL] Email failed:', emailErr.message);
    }

    return res.status(200).json({ received: true, key: key, plan: plan, persisted: saved });
  }

  // Andere PayPal Events ignorieren
  if (body.event_type) {
    return res.status(200).json({ received: true, ignored: true });
  }

  return res.status(400).json({ error: 'Unknown action. Use: validate, generate, manual-generate' });
};
