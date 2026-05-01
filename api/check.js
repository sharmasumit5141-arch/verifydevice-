import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
  const { botid, tgid } = req.query;

  if (!botid || !tgid) {
    return res.json({
      status: "error",
      message: "Missing params"
    });
  }

  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db("verifyapp");

  const successCol = db.collection(`bot_${botid}`);
  const failedCol = db.collection(`bot_${botid}_failed`);

  try {

    // ✅ 1. Check success
    const user = await successCol.findOne({ tgId: tgid });

    if (user) {
      return res.json({
        status: "success",
        deviceId: user.deviceId,
        verifiedAt: user.verifiedAt
      });
    }

    // ❌ 2. Check failed attempts (latest)
    const failed = await failedCol
      .find({ tgId: tgid })
      .sort({ attemptedAt: -1 })
      .limit(1)
      .toArray();

    if (failed.length > 0) {
      return res.json({
        status: "fail",
        reason: failed[0].reason,
        attemptedAt: failed[0].attemptedAt
      });
    }

    // ⏳ 3. Not verified yet
    return res.json({
      status: "pending",
      message: "User not complete verification"
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
