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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { botid, tgid, deviceid } = req.query;

  // ── Missing params ─────────────────────────────────────────────────────────
  if (!botid || !tgid) {
    return res.status(400).json({
      status: 'error',
      success: false,
      message: 'Missing required params: botid and tgid',
      example: '/api/check?botid=BOT123&tgid=TG456',
      code: 400
    });
  }

  try {
    const db = await getDB();
    const col = db.collection('verifications');

    // ── FAIL: Same device kisi aur tgId se linked hai is bot mein ─────────
    if (deviceid) {
      const deviceRecord = await col.findOne({ botId: botid, deviceId: deviceid });
      if (deviceRecord && deviceRecord.tgId !== tgid) {
        return res.status(200).json({
          status: 'already_device',
          success: false,
          message: 'Same device detected — already registered with another Telegram account',
          deviceId: deviceid,
          botId: botid,
          verifiedAt: deviceRecord.verifiedAt
        });
      }
    }

    const record = await col.findOne({ botId: botid, tgId: tgid });

    // ── SUCCESS: Verified record mila ──────────────────────────────────────
    if (record) {
      return res.status(200).json({
        status: 'verified',
        success: true,
        message: 'User is verified',
        tgId: record.tgId,
        botId: record.botId,
        deviceId: record.deviceId,
        username: record.username || 'Unknown',
        verifiedAt: record.verifiedAt
      });
    }

    // ── FAIL: Record nahi mila = kabhi verify nahi kiya ───────────────────
    return res.status(200).json({
      status: 'not_verified',
      success: false,
      message: 'User has not completed verification',
      tgId: tgid,
      botId: botid,
      verifiedAt: null
    });

  } catch (err) {
    console.error('[CHECK ERROR]', err.message);
    return res.status(500).json({
      status: 'error',
      success: false,
      message: 'Internal server error',
      code: 500
    });
  }
};
