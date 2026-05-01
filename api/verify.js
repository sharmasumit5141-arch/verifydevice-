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
    const db      = await getDB();
    const col     = db.collection('verifications');
    const failCol = db.collection('failed_verifications');

    // ── STEP 1: Pehle device ID check karo is bot mein ────────────────────
    // Agar device mili aur tgId ALAG hai → FAIL
    const deviceRecord = await col.findOne({ botId, deviceId });

    if (deviceRecord) {
      if (deviceRecord.tgId !== tgId) {
        // ❌ Same device, alag Telegram ID → BLOCK
        await failCol.insertOne({
          botId,
          tgId,
          deviceId,
          username:    username || 'Unknown',
          reason:      'already_device',
          message:     'Device registered with different Telegram account',
          attemptedAt: new Date()
        });

        return res.status(200).json({
          status:  'already_device',
          success: false,
          message: 'Same device detected — this device is already registered with a different Telegram account on this bot',
          deviceId,
          botId,
          verifiedAt: deviceRecord.verifiedAt
        });

      } else {
        // ✅ Same device, same tgId → already verified
        await failCol.insertOne({
          botId,
          tgId,
          deviceId,
          username:    username || 'Unknown',
          reason:      'already_tgid',
          message:     'Telegram account already verified on this bot',
          attemptedAt: new Date()
        });

        return res.status(200).json({
          status:     'already_tgid',
          success:    false,
          message:    'This Telegram account is already verified on this bot',
          tgId,
          botId,
          deviceId:   deviceRecord.deviceId,
          verifiedAt: deviceRecord.verifiedAt
        });
      }
    }

    // ── STEP 2: Device nahi mili — tgId check karo ────────────────────────
    // Agar tgId kisi aur device se already verified hai → FAIL
    const tgRecord = await col.findOne({ botId, tgId });

    if (tgRecord) {
      await failCol.insertOne({
        botId,
        tgId,
        deviceId,
        username:    username || 'Unknown',
        reason:      'already_tgid_other_device',
        message:     'Telegram account already verified with a different device',
        attemptedAt: new Date()
      });

      return res.status(200).json({
        status:     'already_tgid',
        success:    false,
        message:    'This Telegram account is already verified with a different device on this bot',
        tgId,
        botId,
        verifiedAt: tgRecord.verifiedAt
      });
    }

    // ── STEP 3: Naya device + Naya tgId → SUCCESS ─────────────────────────
    const now = new Date();
    await col.insertOne({
      botId,
      tgId,
      deviceId,
      username:   username || 'Unknown',
      verifiedAt: now,
      status:     'success'
    });

    return res.status(201).json({
      status:     'success',
      success:    true,
      message:    'Device verified successfully',
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
