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
  res.setHeader("Content-Type", "application/json");

  const { botid, tgid, username, deviceid } = req.query;

  if (!botid || !tgid || !deviceid) {
    return res.json({
      status: "error",
      message: "Missing params"
    });
  }

  try {
    const db = await getDB();

    const successCol = db.collection(`bot_${botid}`);
    const failedCol  = db.collection(`bot_${botid}_failed`);

    const tgId = tgid;
    const deviceId = deviceid;

    // 🔥 Get IP + UA
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "unknown";

    const userAgent = req.headers["user-agent"] || "unknown";

    // ❌ DEVICE CONFLICT (MAIN RULE)
    const deviceUsed = await successCol.findOne({
      deviceId,
      tgId: { $ne: tgId }
    });

    if (deviceUsed) {
      await failedCol.insertOne({
        deviceId,
        tgId,
        ip,
        userAgent,
        reason: "Device already linked to another account",
        attemptedAt: new Date()
      });

      return res.json({
        status: "fail",
        message: "Device already used by another user"
      });
    }

    // ⚠️ IP ABUSE CHECK
    const sameIPCount = await successCol.countDocuments({ ip });

    if (sameIPCount > 5) {
      return res.json({
        status: "fail",
        message: "Too many accounts from same network"
      });
    }

    // ✅ Already verified
    const existing = await successCol.findOne({ tgId });

    if (existing) {
      return res.json({
        status: "verified",
        message: "Already verified",
        deviceId: existing.deviceId
      });
    }

    // ✅ Save new
    await successCol.insertOne({
      botId: botid,
      tgId,
      username,
      deviceId,
      ip,
      userAgent,
      verifiedAt: new Date()
    });

    return res.json({
      status: "verified",
      message: "Verified successfully",
      deviceId
    });

  } catch (err) {
    return res.json({
      status: "error",
      message: err.message
    });
  }
};
