// api/register.js
const { getDb } = require('../lib/mongo');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const { botid, tgid, deviceId, fingerprint } = req.body || {};

  if (!botid || !tgid || !deviceId) {
    return res.status(400).json({
      status: 'error',
      message: 'botid, tgid, and deviceId are required'
    });
  }

  // Get real IP from Vercel headers
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';

  try {
    const db = await getDb();
    // Each bot gets its own collection: bot_987654321
    const col = db.collection(`bot_${botid}`);

    // ─── FAIL CHECK: Is this deviceId+botid already owned by a different tgid?
    const conflict = await col.findOne({
      deviceId: String(deviceId),
      botid: String(botid),
      tgid: { $ne: String(tgid) }
    });

    if (conflict) {
      return res.status(200).json({
        status: 'fail',
        code: 403,
        message: 'This device is already registered to another Telegram account',
        registered_tgid: conflict.tgid
      });
    }

    // ─── UPSERT: Save or update record for this tgid
    const now = new Date();
    await col.updateOne(
      { tgid: String(tgid) },
      {
        $setOnInsert: { createdAt: now },
        $set: {
          botid: String(botid),
          deviceId: String(deviceId),
          ip,
          fingerprint: fingerprint || {},
          updatedAt: now
        }
      },
      { upsert: true }
    );

    return res.status(200).json({
      status: 'success',
      code: 200,
      message: 'Device registered successfully',
      tgid,
      botid,
      deviceId,
      ip
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Internal server error',
      detail: err.message
    });
  }
};
      
