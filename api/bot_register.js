import { connectDB } from "./_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { botHash, bot, webhook_url, bot_token } = req.query;

  if (!botHash || !bot || !webhook_url || !bot_token) {
    return res.json({ status: "error", message: "Missing parameters" });
  }

  try {
    const db = await connectDB();

    // Save session in DB
    await db.collection("sessions").insertOne({
      botHash,
      bot,
      webhook_url,
      bot_token,
      status: "pending",
      createdAt: new Date(),
    });

    return res.json({ status: "ok", message: "Bot registered" });
  } catch (err) {
    return res.json({ status: "error", message: err.message });
  }
}
