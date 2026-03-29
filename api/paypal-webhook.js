// KitaShift·KI — PayPal Webhook + Auto License Key + Email
// Vercel Serverless Function
// © 2026 BDS Bieler Distribution Service

const https = require('https');
const nodemailer = require('nodemailer');

// ─── KONFIGURATION (Environment Variables in Vercel setzen!) ───
// PAYPAL_WEBHOOK_ID     → aus PayPal Developer Dashboard
// SMTP_USER             → info@save-house.de
// SMTP_PASS             → dein Strato E-Mail Passwort
// ADMIN_SECRET          → kitashift-admin-2026

// ─── Key-Speicher (in-memory + als Backup in Logs) ───
// In Produktion: Vercel KV oder Datenbank verwenden
const GENERATED_KEYS = {};

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

function getPlanFromAmount(amount) {
  var a = parseFloat(amount);
  if (a <= 0) return null; // free
  if (a >= 48 || a >= 50) return 'traeger';
  return 'pro';
}

function getMonthsFromAmount(amount) {
  var a = parseFloat(amount);
  // Jahresabos
  if (a >= 150 && a <= 170) return 12; // CHF 154 / EUR 162
  if (a >= 380 && a <= 420) return 12; // CHF 390 / EUR 408
  // Monatlich
  return 1;
}

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
    + '<h1 style="margin:0;font-size:1.5rem;">🏡 KitaShift·KI</h1>'
    + '<p style="margin:4px 0 0;opacity:.8;font-size:.9rem;">Ihr Lizenzkey ist bereit!</p>'
    + '</div>'
    + '<div style="background:#f8fafc;border:1px solid #d1dbe8;border-top:none;padding:24px;border-radius:0 0 12px 12px;">'
    + '<p>Hallo ' + (customerName || 'Kunde') + ',</p>'
    + '<p>vielen Dank für Ihren Kauf der <strong>' + planName + '</strong>!</p>'
    + '<div style="background:white;border:2px solid #1a3a5c;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">'
    + '<div style="font-size:.8rem;color:#64748b;margin-bottom:8px;">Ihr Lizenzkey:</div>'
    + '<div style="font-size:1.8rem;font-weight:900;font-family:monospace;letter-spacing:.15em;color:#1a3a5c;">' + licenseKey + '</div>'
    + '<div style="font-size:.78rem;color:#64748b;margin-top:8px;">Gültig bis: ' + validUntil + '</div>'
    + '</div>'
    + '<h3 style="color:#1a3a5c;">So aktivieren Sie Ihre Lizenz:</h3>'
    + '<ol style="line-height:1.8;">'
    + '<li>Öffnen Sie <a href="https://kitaplan.save-house.de/app.html" style="color:#2563a8;font-weight:600;">kitaplan.save-house.de/app.html</a></li>'
    + '<li>Klicken Sie oben auf den <strong>🔒 Free</strong> Button</li>'
    + '<li>Geben Sie Ihren Lizenzkey ein: <code style="background:#e8f4fd;padding:2px 8px;border-radius:4px;">' + licenseKey + '</code></li>'
    + '<li>Klicken Sie auf <strong>"Lizenz aktivieren"</strong></li>'
    + '</ol>'
    + '<p>Bei Fragen antworten Sie einfach auf diese E-Mail.</p>'
    + '<p>Mit freundlichen Grüßen,<br/><strong>Matthias Bieler</strong><br/>BDS Bieler Distribution Service<br/>'
    + '<a href="https://kitaplan.save-house.de" style="color:#2563a8;">kitaplan.save-house.de</a></p>'
    + '</div></body></html>';

  var mailOptions = {
    from: '"KitaShift·KI" <' + (process.env.SMTP_USER || 'info@save-house.de') + '>',
    to: toEmail,
    subject: '🔑 Ihr KitaShift·KI Lizenzkey — ' + planName,
    html: htmlBody
  };

  return transporter.sendMail(mailOptions);
}

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: Status ──
  if (req.method === 'GET') {
    return res.json({
      service: 'KitaShift KI PayPal Webhook',
      status: 'online',
      keysGenerated: Object.keys(GENERATED_KEYS).length
    });
  }

  // ── POST: PayPal Webhook oder manueller Aufruf ──
  if (req.method === 'POST') {
    var body = req.body || {};

    // ─── MANUELL: Key generieren + E-Mail senden ───
    if (body.action === 'manual-generate') {
      var ADMIN_SECRET = process.env.ADMIN_SECRET || 'kitashift-admin-2026';
      if (body.secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

      var plan = body.plan || 'pro';
      var email = body.email;
      var months = body.months || 12;
      var name = body.name || '';

      if (!email) return res.status(400).json({ error: 'E-Mail fehlt' });

      var key = generateKey(plan);
      var validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + months);
      var validStr = validUntil.toISOString().substring(0, 10);

      // Key speichern (in-memory)
      GENERATED_KEYS[key] = { plan: plan, email: email, validUntil: validStr, maxMA: plan === 'traeger' ? 999 : 20 };

      // E-Mail senden
      try {
        await sendLicenseEmail(email, name, key, plan, validStr);
        console.log('[MANUAL] Key generated and emailed:', key, '->', email);
        return res.json({
          success: true, key: key, plan: plan, email: email, validUntil: validStr,
          message: 'Key generiert und E-Mail gesendet!'
        });
      } catch (emailErr) {
        console.error('[MANUAL] Email failed:', emailErr.message);
        return res.json({
          success: true, key: key, plan: plan, email: email, validUntil: validStr,
          warning: 'Key generiert, aber E-Mail fehlgeschlagen: ' + emailErr.message,
          note: 'Key manuell an Kunden senden!'
        });
      }
    }

    // ─── PAYPAL WEBHOOK: Automatisch nach Zahlung ───
    if (body.event_type === 'PAYMENT.CAPTURE.COMPLETED' || body.event_type === 'CHECKOUT.ORDER.APPROVED') {
      console.log('[PAYPAL WEBHOOK] Event:', body.event_type);

      var resource = body.resource || {};
      var payer = resource.payer || {};
      var payerEmail = payer.email_address || '';
      var payerName = (payer.name || {}).given_name || '';
      var amount = '0';

      // Amount aus verschiedenen PayPal-Strukturen extrahieren
      if (resource.amount) {
        amount = resource.amount.value || '0';
      } else if (resource.purchase_units && resource.purchase_units[0]) {
        var pu = resource.purchase_units[0];
        amount = (pu.amount || {}).value || '0';
      }

      console.log('[PAYPAL] Payer:', payerEmail, 'Amount:', amount);

      if (!payerEmail) {
        console.error('[PAYPAL] No payer email found');
        return res.status(200).json({ received: true, error: 'No email' });
      }

      var plan = getPlanFromAmount(amount);
      if (!plan) {
        console.log('[PAYPAL] Free plan, no key needed');
        return res.status(200).json({ received: true, plan: 'free' });
      }

      var months = getMonthsFromAmount(amount);
      var key = generateKey(plan);
      var validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + months);
      var validStr = validUntil.toISOString().substring(0, 10);

      GENERATED_KEYS[key] = { plan: plan, email: payerEmail, validUntil: validStr, maxMA: plan === 'traeger' ? 999 : 20 };

      console.log('[PAYPAL] Generated key:', key, 'for', payerEmail, 'plan:', plan, 'valid:', validStr);

      // E-Mail senden
      try {
        await sendLicenseEmail(payerEmail, payerName, key, plan, validStr);
        console.log('[PAYPAL] License email sent to', payerEmail);
      } catch (emailErr) {
        console.error('[PAYPAL] Email failed:', emailErr.message);
      }

      return res.status(200).json({ received: true, key: key, plan: plan });
    }

    // Andere PayPal Events ignorieren
    if (body.event_type) {
      console.log('[PAYPAL] Ignored event:', body.event_type);
      return res.status(200).json({ received: true, ignored: true });
    }

    return res.status(400).json({ error: 'Unknown request' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
