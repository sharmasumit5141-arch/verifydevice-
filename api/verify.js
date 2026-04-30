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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { botId, tgId, deviceId, username } = req.body;

  if (!botId || !tgId || !deviceId) {
    return res.status(400).json({ status: 'error', message: 'Missing required fields' });
  }

  try {
    const db = await getDB();
    const col = db.collection('verifications');

    // Check Telegram ID for this bot
    const tgExists = await col.findOne({ botId, tgId });
    if (tgExists) {
      await col.insertOne({
        botId,
        tgId,
        deviceId,
        username: username || 'Unknown',
        verifiedAt: new Date(),
        status: 'already_tgid'
      });
      return res.json({ status: 'already_tgid', message: 'Verification failed already link with another account' });
    }

    // Check Device ID for this bot
    const deviceExists = await col.findOne({ botId, deviceId });
    if (deviceExists) {
      await col.insertOne({
        botId,
        tgId,
        deviceId,
        username: username || 'Unknown',
        verifiedAt: new Date(),
        status: 'already_device'
      });
      return res.json({ status: 'already_device', message: 'Verification failed already link with another account' });
    }

    // Save new verification
    await col.insertOne({
      botId,
      tgId,
      deviceId,
      username: username || 'Unknown',
      verifiedAt: new Date(),
      status: 'success'
    });

    return res.json({ status: 'success', message: 'Verified successfully' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

