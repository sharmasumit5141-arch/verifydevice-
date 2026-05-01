const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI;
let client;

async function getDB() {
  if (!client) {
    client = new MongoClient(MONGO_URI);
    await client.connect();
  }
  return client.db("verifyapp");
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { botid, tgid, deviceid } = req.query;

  if (!botid || !tgid) {
    return res.status(400).json({
      status: "error",
      success: false,
      message: "Missing required params: botid and tgid",
      code: 400
    });
  }

  try {
    const db = await getDB();

    // 🔥 Per-bot collection (tumhara design)
    const successCol = db.collection(`bot_${botid}`);
    const failedCol  = db.collection(`bot_${botid}_failed`);

    // ❌ 1. Same device used by different tgId
    if (deviceid) {
      const deviceRecord = await successCol.findOne({
        deviceId: deviceid,
        tgId: { $ne: tgid }
      });

      if (deviceRecord) {
        return res.status(200).json({
          status: "fail",
          success: false,
          message: "Device already used by another user",
          deviceId: deviceid,
          verifiedAt: deviceRecord.verifiedAt
        });
      }
    }

    // ✅ 2. Check verified user
    const record = await successCol.findOne({ tgId: tgid });

    if (record) {
      return res.status(200).json({
        status: "verified",
        success: true,
        message: "User is verified",
        tgId: record.tgId,
        botId: botid,
        deviceId: record.deviceId,
        username: record.username || "Unknown",
        verifiedAt: record.verifiedAt
      });
    }

    // ❌ 3. Check failed logs (latest attempt)
    const failed = await failedCol
      .find({ tgId: tgid })
      .sort({ attemptedAt: -1 })
      .limit(1)
      .toArray();

    if (failed.length > 0) {
      return res.status(200).json({
        status: "fail",
        success: false,
        message: failed[0].reason,
        attemptedAt: failed[0].attemptedAt
      });
    }

    // ⏳ 4. Not verified
    return res.status(200).json({
      status: "not_verified",
      success: false,
      message: "User has not completed verification",
      tgId: tgid,
      botId: botid
    });

  } catch (err) {
    console.error("[CHECK ERROR]", err.message);

    return res.status(500).json({
      status: "error",
      success: false,
      message: err.message, // 👈 debugging ke liye useful
      code: 500
    });
  }
};
