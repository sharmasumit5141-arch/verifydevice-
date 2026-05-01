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

  try {

    // 🔍 Check user
    const user = await successCol.findOne({ tgId: tgid });

    if (!user) {
      return res.json({
        status: "pending",
        message: "User not complete verification"
      });
    }

    return res.json({
      status: "success",
      deviceId: user.deviceId,
      verifiedAt: user.verifiedAt
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
