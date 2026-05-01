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

  const { botid, tgid } = req.query;

  if (!botid || !tgid) {
    return res.status(400).json({
      status: "error",
      success: false,
      message: "Missing required params",
      code: 400
    });
  }

  try {
    const db = await getDB();

    const successCol = db.collection(`bot_${botid}`);
    const failedCol  = db.collection(`bot_${botid}_failed`);

    const tgId = tgid;

    // ✅ Check verified
    const user = await successCol.findOne({ tgId: tgId });

    if (user) {
      return res.status(200).json({
        status: "verified",
        success: true,
        deviceId: user.deviceId,
        verifiedAt: user.verifiedAt
      });
    }

    // ❌ Check failed logs
    const failed = await failedCol
      .find({ tgId: tgId })
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

    // ⏳ Not verified
    return res.status(200).json({
      status: "not_verified",
      success: false,
      message: "User not verified yet"
    });

  } catch (err) {
    console.error("[CHECK ERROR]", err.message);

    return res.status(500).json({
      status: "error",
      success: false,
      message: err.message,
      code: 500
    });
  }
};
