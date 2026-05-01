const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI;
let client;

// 🔹 DB connection reuse
async function getDB() {
  if (!client) {
    client = new MongoClient(MONGO_URI);
    await client.connect();
  }
  return client.db("verifyapp");
}

// 🔹 deviceId generate (tgId based)
function generateDeviceId(tgId) {
  return "DEV-" + Buffer.from(tgId).toString("hex").slice(0, 8).toUpperCase();
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(200).end();

  // ✅ FIXED naming
  const { botid, tgid, username } = req.query;

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

    const successCol = db.collection(`bot_${botid}`);
    const failedCol  = db.collection(`bot_${botid}_failed`);

    const tgId = tgid; // ✅ unify naming
    const deviceId = generateDeviceId(tgId);

    // ✅ 1. Already verified
    const existing = await successCol.findOne({ tgId: tgId });

    if (existing) {
      return res.status(200).json({
        status: "verified",
        success: true,
        message: "Already verified",
        deviceId: existing.deviceId
      });
    }

    // ❌ 2. Device conflict
    const conflict = await successCol.findOne({
      deviceId: deviceId,
      tgId: { $ne: tgId }
    });

    if (conflict) {
      await failedCol.insertOne({
        deviceId,
        tgId,
        reason: "Device already used by another user",
        attemptedAt: new Date()
      });

      return res.status(200).json({
        status: "fail",
        success: false,
        message: "Device already used by another user"
      });
    }

    // ✅ 3. Save success
    await successCol.insertOne({
      botId: botid,
      tgId: tgId,
      username: username || "Unknown",
      deviceId,
      verifiedAt: new Date()
    });

    return res.status(200).json({
      status: "verified",
      success: true,
      message: "Verified successfully",
      deviceId
    });

  } catch (err) {
    console.error("[VERIFY ERROR]", err.message);

    return res.status(500).json({
      status: "error",
      success: false,
      message: err.message,
      code: 500
    });
  }
};
