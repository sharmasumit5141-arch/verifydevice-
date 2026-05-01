import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

// 🔹 deviceId generate (tgId based - fixed)
function generateDeviceId(tgid) {
  return "DEV-" + Buffer.from(tgid).toString("hex").slice(0, 8).toUpperCase();
}

export default async function handler(req, res) {
  const { botid, tgid, username } = req.query;

  if (!botid || !tgid) {
    return res.json({ status: "error", message: "Missing params" });
  }

  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db("verifyapp");

  const successCol = db.collection(`bot_${botid}`);
  const failedCol = db.collection(`bot_${botid}_failed`);

  const deviceId = generateDeviceId(tgid);

  try {

    // ✅ 1. Already verified check
    const existing = await successCol.findOne({ tgId: tgid });

    if (existing) {
      return res.json({
        status: "success",
        message: "Already Verified",
        deviceId: existing.deviceId
      });
    }

    // ❌ 2. Conflict check (same device used by another tgId)
    const conflict = await successCol.findOne({
      deviceId,
      tgId: { $ne: tgid }
    });

    if (conflict) {

      // save fail log
      await failedCol.insertOne({
        deviceId,
        tgId,
        reason: "Device already used",
        attemptedAt: new Date()
      });

      return res.json({
        status: "fail",
        message: "Device already used by another user"
      });
    }

    // ✅ 3. Save success
    await successCol.insertOne({
      deviceId,
      tgId,
      username: username || null,
      verifiedAt: new Date()
    });

    return res.json({
      status: "success",
      message: "Verified Successfully",
      deviceId
    });

  } catch (err) {

    return res.json({
      status: "error",
      message: "Server error"
    });

  } finally {
    await client.close();
  }
}
