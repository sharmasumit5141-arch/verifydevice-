// api/verify.js
const { getCollection } = require("../lib/mongodb");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  const { botid, tgid } = req.query;

  if (!botid || !tgid) {
    return res.status(400).json({
      status: "error",
      message: "botid aur tgid dono required hain",
    });
  }

  try {
    const collection = await getCollection(botid);

    const existing = await collection.findOne({ tgid: String(tgid) });

    if (!existing) {
      return res.status(404).json({
        status: "error",
        message: "Device nahi mili, pehle /api/check karo",
      });
    }

    if (existing.status === "verified") {
      return res.status(200).json({
        status: "success",
        result: "already_verified",
        message: "Device pehle se verified hai",
      });
    }

    // Mark as verified
    await collection.updateOne(
      { tgid: String(tgid) },
      {
        $set: {
          status: "verified",
          verified_at: new Date().toISOString(),
        },
      }
    );

    return res.status(200).json({
      status: "success",
      result: "verified",
      message: "Device successfully verified ho gayi",
      data: {
        botid: String(botid),
        tgid: String(tgid),
        verified_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("DB Error:", err);
    return res.status(500).json({
      status: "error",
      message: "Server error aaya",
    });
  }
};
