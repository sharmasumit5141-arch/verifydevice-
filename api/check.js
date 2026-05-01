// api/check.js
const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI;

function getClient() {
  if (!global._mongoClient) {
    const client = new MongoClient(uri);
    global._mongoClient = client.connect().then(() => client);
  }
  return global._mongoClient;
}

async function getCollections(botId) {
  const client = await getClient();
  const db = client.db("device_verify");
  const safe = String(botId).replace(/[^a-zA-Z0-9_]/g, "_");
  return {
    devices: db.collection(`bot_${safe}_devices`),
    tgids:   db.collection(`bot_${safe}_tgids`),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  const { botid, tgid, deviceid } = req.query;

  if (!botid || !tgid || !deviceid) {
    return res.status(400).json({
      status: "error",
      result: "error",
      message: "botid, tgid aur deviceid teeno chahiye",
    });
  }

  try {
    const { devices, tgids } = await getCollections(botid);

    const existingDevice = await devices.findOne({ deviceid: String(deviceid) });
    const existingTgid   = await tgids.findOne({ tgid: String(tgid) });

    // ── CASE 1: Dono exist karte hain ──
    if (existingDevice && existingTgid) {
      if (existingDevice.tgid === String(tgid)) {
        // Same device + same tgid → SUCCESS
        return res.status(200).json({
          status: "success",
          result: "same_device",
          message: "Device aur TG ID match — verified!",
        });
      } else {
        // Device exist hai lekin alag tgid ke saath
        return res.status(200).json({
          status: "fail",
          result: "device_conflict",
          message: "Yeh device kisi aur TG ID ke saath register hai",
        });
      }
    }

    // ── CASE 2: Device nahi, tgid exist karta hai ──
    if (!existingDevice && existingTgid) {
      return res.status(200).json({
        status: "fail",
        result: "tgid_conflict",
        message: "Yeh TG ID kisi aur device pe already register hai",
      });
    }

    // ── CASE 3: Device exist karta hai, tgid nahi ──
    if (existingDevice && !existingTgid) {
      return res.status(200).json({
        status: "fail",
        result: "device_taken",
        message: "Yeh device kisi aur TG ID se linked hai",
      });
    }

    // ── CASE 4: Dono naye hain → Register + Directly Verify ──
    const now = new Date().toISOString();

    await devices.insertOne({
      deviceid:   String(deviceid),
      tgid:       String(tgid),
      botid:      String(botid),
      status:     "verified",
      created_at: now,
    });

    await tgids.insertOne({
      tgid:       String(tgid),
      deviceid:   String(deviceid),
      botid:      String(botid),
      status:     "verified",
      created_at: now,
    });

    return res.status(200).json({
      status: "success",
      result: "same_device",
      message: "Device register aur verify ho gaya!",
    });

  } catch (err) {
    console.error("DB Error:", err);
    return res.status(500).json({
      status: "error",
      result: "error",
      message: "Server error — baad mein try karo",
    });
  }
};
