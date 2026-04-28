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

  const { botid, tgid } = req.query;

  if (!botid || !tgid) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing botid or tgid',
      code: 400
    });
  }

  try {
    const db = await getDB();
    const col = db.collection('verifications');

    const record = await col.findOne({ botId: botid, tgId: tgid });

    if (record) {
      // ✅ SUCCESS — verified mila
      return res.json({
        status: 'verified',
        message: 'User is verified',
        tgId: record.tgId,
        deviceId: record.deviceId,
        username: record.username,
        botId: record.botId,
        verifiedAt: record.verifiedAt
      });

    } else {
      // ❌ FAIL — verified nahi mila
      return res.json({
        status: 'not_verified',
        message: 'User has not completed verification',
        tgId: tgid,
        botId: botid,
        verifiedAt: null
      });
    }

  } catch (err) {
    // ⚠️ SERVER ERROR
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      code: 500
    });
  }
};
