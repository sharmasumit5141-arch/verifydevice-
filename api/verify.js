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

    // Sirf deviceId check karo is botId ke liye
    const deviceExists = await col.findOne({ botId, deviceId });

    if (deviceExists) {
      if (deviceExists.tgId === tgId) {
        // Same device, same tgId — already verified
        return res.json({ status: 'already_verified', message: 'Already verified' });
      } else {
        // Same device, alag tgId — FAIL
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
    }

    // Device naya hai — verify karo
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
