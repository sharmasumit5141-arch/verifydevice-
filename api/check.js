/**
 * /api/check — GET
 * Query: ?botid=xxx&tgid=xxx[&deviceid=xxx]
 *
 * RESPONSES:
 *  status: "verified"       → tgId verified in this bot ✅
 *  status: "not_verified"   → tgId not found in this bot
 *  status: "already_device" → deviceId belongs to different tgId (if deviceid passed)
 *  status: "error"          → missing params / server crash
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { botid, tgid, deviceid } = req.query;

  if (!botid || !tgid) {
    return res.status(400).json({
      status:  'error',
      success: false,
      message: 'Missing required: botid and tgid',
      example: '/api/check?botid=BOT123&tgid=987654321',
      code:    400
    });
  }

  try {
    const db  = await getDB();
    const col = db.collection(`bot_${botid}`);

    // Optional device check
    if (deviceid) {
      const dr = await col.findOne({ deviceId: deviceid });
      if (dr && dr.tgId !== tgid) {
        return res.status(200).json({
          status:     'already_device',
          success:    false,
          message:    'Same device already linked with another account',
          deviceId:   deviceid,
          botId:      botid,
          verifiedAt: dr.verifiedAt
        });
      }
    }

    const record = await col.findOne({ tgId: tgid });

    if (record) {
      return res.status(200).json({
        status:     'verified',
        success:    true,
        message:    'User is verified in this bot',
        tgId:       record.tgId,
        botId:      botid,
        deviceId:   record.deviceId,
        username:   record.username || 'Unknown',
        verifiedAt: record.verifiedAt
      });
    }

    return res.status(200).json({
      status:     'not_verified',
      success:    false,
      message:    'User has not completed verification in this bot',
      tgId:       tgid,
      botId:      botid,
      verifiedAt: null
    });

  } catch (err) {
    console.error('[CHECK ERROR]', err.message);
    return res.status(500).json({
      status:  'error',
      success: false,
      message: 'Internal server error',
      code:    500
    });
  }
};
