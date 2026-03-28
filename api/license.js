// KitaShift·KI — License API | Vercel Serverless Function
// © 2026 BDS Bieler Distribution Service

const VALID_KEYS = {
  'PRO-2026-DEMO-TEST': { plan: 'pro', email: 'demo@test.de', validUntil: '2026-12-31', maxMA: 20 },
  'TRG-2026-DEMO-TEST': { plan: 'traeger', email: 'demo@test.de', validUntil: '2026-12-31', maxMA: 999 },
};

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

module.exports = function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    var body = req.body || {};

    if (body.action === 'validate') {
      if (!body.key) return res.status(400).json({ valid: false, error: 'Kein Key' });
      var license = VALID_KEYS[body.key.toUpperCase().trim()];
      if (!license) return res.json({ valid: false, error: 'Ungültiger Lizenzkey' });
      if (license.validUntil && new Date(license.validUntil) < new Date()) {
        return res.json({ valid: false, error: 'Lizenz abgelaufen', expired: true });
      }
      return res.json({
        valid: true, plan: license.plan, maxMA: license.maxMA,
        validUntil: license.validUntil,
        features: { excelImport: true, twoWeeks: true, datev: true, apiKey: true, dragDrop: true, pdfClean: true }
      });
    }

    if (body.action === 'generate') {
      var ADMIN_SECRET = process.env.ADMIN_SECRET || 'kitashift-admin-2026';
      if (body.secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });
      var newKey = generateKey(body.plan || 'pro');
      var validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + (body.months || 12));
      return res.json({
        key: newKey, plan: body.plan || 'pro', email: body.email || '',
        validUntil: validUntil.toISOString().substring(0, 10),
        note: 'Diesen Key in api/license.js VALID_KEYS eintragen!'
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.json({ service: 'KitaShift KI License API', status: 'online', version: '1.0' });
};
