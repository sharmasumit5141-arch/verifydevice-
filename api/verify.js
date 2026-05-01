/**
 * /api/verify — POST
 * Body: { botId, tgId, deviceId, username }
 *
 * Har bot ka alag collection: bot_<botId>
 *
 * RESPONSES:
 *  status: "success"          → New device, new user — saved ✅
 *  status: "already_verified" → Same device + same tgId — already done ✅
 *  status: "already_device"   → Same device + ALAG tgId — DIRECT FAIL ❌
 *  status: "error"            → Missing fields / server crash
 */

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
      status:  'error',
      success: false,
      message: 'Only POST method allowed',
      code:    405
    });
  }

  const { botId, tgId, deviceId, username } = req.body || {};

  if (!botId || !tgId || !deviceId) {
    return res.status(400).json({
      status:  'error',
      success: false,
      message: 'Missing required fields: botId, tgId, deviceId',
      code:    400
    });
  }

  try {
    const db      = await getDB();
    const col     = db.collection(`bot_${botId}`);        // is bot ka collection
    const failCol = db.collection(`bot_${botId}_failed`); // failed log

    // ── Sirf deviceId check karo is bot ke andar ─────────────────────
    const existing = await col.findOne({ deviceId });

    if (existing) {

      if (existing.tgId === tgId) {
        // ✅ Same device + same tgId → Already verified
        return res.status(200).json({
          status:     'already_verified',
          success:    true,
          message:    'Already verified in this bot',
          tgId,
          botId,
          deviceId,
          username:   existing.username || username || 'Unknown',
          verifiedAt: existing.verifiedAt
        });

      } else {
        // ❌ Same device + ALAG tgId → DIRECT FAIL
        await failCol.insertOne({
          tgId,
          deviceId,
          username:    username || 'Unknown',
          reason:      'device_conflict',
          message:     'Same device already linked with another account',
          attemptedAt: new Date()
        });

        return res.status(200).json({
          status:     'already_device',
          success:    false,
          message:    'Same device already linked with another account',
          deviceId,
          botId,
          verifiedAt: existing.verifiedAt
        });
      }
    }

    // ── deviceId nahi mili → Save karo ──────────────────────────────
    const now = new Date();
    await col.insertOne({
      deviceId,
      tgId,
      username:   username || 'Unknown',
      botId,
      verifiedAt: now,
      status:     'success'
    });

    return res.status(201).json({
      status:     'success',
      success:    true,
      message:    'Device verified and registered successfully',
      tgId,
      botId,
      deviceId,
      username:   username || 'Unknown',
      verifiedAt: now
    });

  } catch (err) {
    console.error('[VERIFY ERROR]', err.message);
    return res.status(500).json({
      status:  'error',
      success: false,
      message: 'Internal server error',
      code:    500
    });
  }
};
