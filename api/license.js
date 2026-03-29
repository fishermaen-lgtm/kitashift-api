// KitaShift·KI — License API + Auto-Email
// Vercel Serverless Function | © 2026 BDS Bieler Distribution Service

var nodemailer = require('nodemailer');

var STATIC_KEYS = {
  'PRO-2026-DEMO-TEST': { plan: 'pro', email: 'demo@test.de', validUntil: '2026-12-31', maxMA: 20 },
  'TRG-2026-DEMO-TEST': { plan: 'traeger', email: 'demo@test.de', validUntil: '2026-12-31', maxMA: 999 },
};

var DYNAMIC_KEYS = {};

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

function sendEmail(toEmail, name, key, plan, validUntil) {
  var transporter = nodemailer.createTransport({
    host: 'smtp.strato.de',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'info@save-house.de',
      pass: process.env.SMTP_PASS || ''
    }
  });

  var planName = plan === 'traeger' ? 'Traeger-Lizenz' : 'Pro-Lizenz';

  var html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
    + '<div style="background:#1a3a5c;color:white;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center;">'
    + '<h1 style="margin:0;">KitaShift KI</h1>'
    + '<p style="margin:4px 0 0;opacity:.8;">Ihr Lizenzkey ist bereit!</p></div>'
    + '<div style="background:#f8fafc;border:1px solid #d1dbe8;border-top:none;padding:24px;border-radius:0 0 12px 12px;">'
    + '<p>Hallo ' + (name || '') + ',</p>'
    + '<p>vielen Dank fuer Ihren Kauf der <strong>' + planName + '</strong>!</p>'
    + '<div style="background:white;border:2px solid #1a3a5c;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">'
    + '<div style="font-size:.8rem;color:#64748b;">Ihr Lizenzkey:</div>'
    + '<div style="font-size:1.8rem;font-weight:900;font-family:monospace;letter-spacing:.15em;color:#1a3a5c;">' + key + '</div>'
    + '<div style="font-size:.78rem;color:#64748b;margin-top:8px;">Gueltig bis: ' + validUntil + '</div></div>'
    + '<h3 style="color:#1a3a5c;">So aktivieren Sie Ihre Lizenz:</h3>'
    + '<ol style="line-height:1.8;">'
    + '<li>Oeffnen Sie <a href="https://kitaplan.save-house.de/app.html">kitaplan.save-house.de/app.html</a></li>'
    + '<li>Klicken Sie oben auf den <strong>Free</strong> Button</li>'
    + '<li>Geben Sie Ihren Lizenzkey ein</li>'
    + '<li>Klicken Sie auf <strong>Lizenz aktivieren</strong></li></ol>'
    + '<p>Bei Fragen antworten Sie einfach auf diese E-Mail.</p>'
    + '<p>Mit freundlichen Gruessen,<br/><strong>Matthias Bieler</strong><br/>BDS Bieler Distribution Service</p>'
    + '</div></div>';

  return transporter.sendMail({
    from: '"KitaShift KI" <' + (process.env.SMTP_USER || 'info@save-house.de') + '>',
    to: toEmail,
    subject: 'Ihr KitaShift KI Lizenzkey - ' + planName,
    html: html
  });
}

function getPlanFromAmount(amount) {
  var a = parseFloat(amount);
  if (a >= 48) return 'traeger';
  if (a > 0) return 'pro';
  return null;
}

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    var body = req.body || {};

    // ── Lizenz pruefen ──
    if (body.action === 'validate') {
      if (!body.key) return res.status(400).json({ valid: false, error: 'Kein Key' });
      var k = body.key.toUpperCase().trim();
      var license = STATIC_KEYS[k] || DYNAMIC_KEYS[k];
      if (!license) return res.json({ valid: false, error: 'Ungueltiger Lizenzkey' });
      if (license.validUntil && new Date(license.validUntil) < new Date()) {
        return res.json({ valid: false, error: 'Lizenz abgelaufen', expired: true });
      }
      return res.json({
        valid: true, plan: license.plan, maxMA: license.maxMA, validUntil: license.validUntil,
        features: { excelImport: true, twoWeeks: true, datev: true, apiKey: true, dragDrop: true, pdfClean: true }
      });
    }

    // ── Key generieren + Email senden ──
    if (body.action === 'generate') {
      var ADMIN_SECRET = process.env.ADMIN_SECRET || 'kitashift-admin-2026';
      if (body.secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });

      var plan = body.plan || 'pro';
      var email = body.email || '';
      var name = body.name || '';
      var months = body.months || 12;

      var newKey = generateKey(plan);
      var validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + months);
      var validStr = validUntil.toISOString().substring(0, 10);

      STATIC_KEYS[newKey] = { plan: plan, email: email, validUntil: validStr, maxMA: plan === 'traeger' ? 999 : 20 };
      DYNAMIC_KEYS[newKey] = STATIC_KEYS[newKey];

      console.log('[LICENSE] Generated:', newKey, 'for', email, 'plan:', plan, 'valid:', validStr);

      // Email senden wenn Adresse vorhanden
      var emailResult = 'no-email';
      if (email) {
        try {
          await sendEmail(email, name, newKey, plan, validStr);
          emailResult = 'sent';
          console.log('[LICENSE] Email sent to', email);
        } catch (err) {
          emailResult = 'failed: ' + err.message;
          console.error('[LICENSE] Email error:', err.message);
        }
      }

      return res.json({
        success: true, key: newKey, plan: plan, email: email, validUntil: validStr,
        emailStatus: emailResult
      });
    }

    // ── PayPal Webhook ──
    if (body.event_type && body.event_type.indexOf('PAYMENT') >= 0) {
      console.log('[PAYPAL]', body.event_type);
      var resource = body.resource || {};
      var payer = resource.payer || {};
      var payerEmail = payer.email_address || '';
      var payerName = ((payer.name || {}).given_name || '');
      var amount = '0';
      if (resource.amount) amount = resource.amount.value || '0';
      else if (resource.purchase_units && resource.purchase_units[0]) {
        amount = (resource.purchase_units[0].amount || {}).value || '0';
      }

      if (!payerEmail) return res.status(200).json({ received: true, error: 'no-email' });

      var plan = getPlanFromAmount(amount);
      if (!plan) return res.status(200).json({ received: true, plan: 'free' });

      var key = generateKey(plan);
      var validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + (parseFloat(amount) > 100 ? 12 : 1));
      var validStr = validUntil.toISOString().substring(0, 10);

      STATIC_KEYS[key] = { plan: plan, email: payerEmail, validUntil: validStr, maxMA: plan === 'traeger' ? 999 : 20 };
      console.log('[PAYPAL] Key:', key, 'for', payerEmail);

      try { await sendEmail(payerEmail, payerName, key, plan, validStr); } catch (e) { console.error('[PAYPAL] Email error:', e.message); }

      return res.status(200).json({ received: true, key: key });
    }

    // Andere PayPal Events
    if (body.event_type) return res.status(200).json({ received: true, ignored: true });

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.json({ service: 'KitaShift KI License API', status: 'online', version: '2.0' });
};
