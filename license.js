// KitaShift·KI — License API | Vercel Serverless Function
// © 2026 BDS Bieler Distribution Service

const VALID_KEYS = {
  // ── Test-Keys (zum Ausprobieren) ──
  'PRO-2026-DEMO-TEST': { plan: 'pro', email: 'demo@test.de', validUntil: '2026-12-31', maxMA: 20 },
  'TRG-2026-DEMO-TEST': { plan: 'traeger', email: 'demo@test.de', validUntil: '2026-12-31', maxMA: 999 },

  // ── Verkaufte Keys hier eintragen ──
  // 'PRO-2026-XXXX-YYYY': { plan: 'pro', email: 'kunde@kita.ch', validUntil: '2027-03-28', maxMA: 20 },
};

function generateKey(plan) {
  const prefix = plan === 'traeger' ? 'TRG' : 'PRO';
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p1 = '', p2 = '';
  for (let i = 0; i < 4; i++) {
    p1 += chars[Math.floor(Math.random() * chars.length)];
    p2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${year}-${p1}-${p2}`;
}

export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { action, key, secret, plan, email, months } = req.body || {};

    if (action === 'validate') {
      if (!key) return res.status(400).json({ valid: false, error: 'Kein Key' });
      const license = VALID_KEYS[key.toUpperCase().trim()];
      if (!license) return res.json({ valid: false, error: 'Ungültiger Lizenzkey' });
      if (license.validUntil && new Date(license.validUntil) < new Date()) {
        return res.json({ valid: false, error: 'Lizenz abgelaufen', expired: true });
      }
      return res.json({
        valid: true, plan: license.plan, maxMA: license.maxMA,
        validUntil: license.validUntil,
        features: { excelImport:true, twoWeeks:true, datev:true, apiKey:true, dragDrop:true, pdfClean:true }
      });
    }

    if (action === 'generate') {
      const ADMIN_SECRET = process.env.ADMIN_SECRET || 'kitashift-admin-2026';
      if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });
      const newKey = generateKey(plan || 'pro');
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + (months || 12));
      return res.json({
        key: newKey, plan: plan || 'pro', email: email || '',
        validUntil: validUntil.toISOString().substring(0, 10),
        note: 'Diesen Key in api/license.js → VALID_KEYS eintragen!'
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.json({ service: 'KitaShift·KI License API', status: 'online' });
}
