const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
let client;

async function getDB() {
  if (!client) {
    client = new MongoClient(MONGO_URI);
    await client.connect();
  }
  return client.db('verifyapp');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'error',
      success: false,
      message: 'Only POST method allowed',
      code: 405
    });
  }

  const { botId, tgId, deviceId, username } = req.body || {};

  // ── Missing fields ─────────────────────────────────────────────────────────
  if (!botId || !tgId || !deviceId) {
    return res.status(400).json({
      status: 'error',
      success: false,
      message: 'Missing required fields: botId, tgId, deviceId',
      code: 400
    });
  }

  try {
    const db = await getDB();
    const col = db.collection('verifications');

    // ── FAIL: Same tgId already verified in this bot ───────────────────────
    const tgExists = await col.findOne({ botId, tgId });
    if (tgExists) {
      return res.status(200).json({
        status: 'already_tgid',
        success: false,
        message: 'This Telegram account is already verified on this bot',
        tgId: tgId,
        botId: botId,
        deviceId: tgExists.deviceId,
        verifiedAt: tgExists.verifiedAt
      });
    }

    // ── FAIL: Same deviceId already used by different tgId in this bot ─────
    const deviceExists = await col.findOne({ botId, deviceId });
    if (deviceExists) {
      return res.status(200).json({
        status: 'already_device',
        success: false,
        message: 'Same device detected — this device is already registered with another Telegram account on this bot',
        deviceId: deviceId,
        botId: botId,
        verifiedAt: deviceExists.verifiedAt
      });
    }

    // ── SUCCESS: New tgId + New device ─────────────────────────────────────
    const now = new Date();
    await col.insertOne({
      botId,
      tgId,
      deviceId,
      username: username || 'Unknown',
      verifiedAt: now,
      status: 'success'
    });

    return res.status(201).json({
      status: 'success',
      success: true,
      message: 'Device verified successfully',
      tgId: tgId,
      botId: botId,
      deviceId: deviceId,
      username: username || 'Unknown',
      verifiedAt: now
    });

  } catch (err) {
    console.error('[VERIFY ERROR]', err.message);
    return res.status(500).json({
      status: 'error',
      success: false,
      message: 'Internal server error',
      code: 500
    });
  }
};
