import { connectDB } from "./_db.js";

async function checkVPN(ip) {
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=proxy,hosting,vpn`);
    const d = await r.json();
    return d.proxy || d.hosting || d.vpn ? "yes" : "no";
  } catch {
    return "no";
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.json({ status: "error", message: "POST only" });

  const { bot_id, callback_url, fingerprint, tg_user_id } = req.body;

  if (!bot_id)       return res.json({ status: "error", message: "Missing bot_id" });
  if (!callback_url) return res.json({ status: "error", message: "Missing callback_url" });
  if (!fingerprint)  return res.json({ status: "error", message: "Missing fingerprint" });

  try {
    const db = await connectDB();

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      req.socket?.remoteAddress || "";

    const vpnStatus = await checkVPN(ip);

    let resultStatus = "success";

    // Same bot_id + Same fingerprint + Same TG = Already Verified
    const alreadyVerified = await db.collection("fingerprints").findOne({
      bot_id,
      fingerprint,
      tg_user_id: tg_user_id || ""
    });

    if (alreadyVerified) {
      resultStatus = "already_verified";

    } else {
      // Same bot_id + Same fingerprint + Different TG = FAIL
      const sameDevice = await db.collection("fingerprints").findOne({
        bot_id,
        fingerprint
      });

      if (sameDevice) {
        resultStatus = "fail"; // ← Different TG = hard fail
      } else {
        // Bilkul naya = save karo
        await db.collection("fingerprints").insertOne({
          bot_id,
          fingerprint,
          tg_user_id: tg_user_id || "",
          ip,
          createdAt: new Date(),
        });
        resultStatus = "success";
      }
    }

    let payload;

    if (vpnStatus === "yes") {
      payload = {
        status: "fail",
        reason: "vpn_detected",
        vpn: "yes",
        bot_id,
        tg_user_id
      };
    } else if (resultStatus === "already_verified") {
      payload = {
        status: "already_verified",
        reason: "same_device_same_tg",
        vpn: "no",
        bot_id,
        tg_user_id
      };
    } else if (resultStatus === "fail") {
      payload = {
        status: "fail",
        reason: "same_device_different_tg",
        vpn: "no",
        bot_id,
        tg_user_id
      };
    } else {
      payload = {
        status: "success",
        reason: "new_device",
        vpn: "no",
        bot_id,
        tg_user_id
      };
    }

    // Callback URL pe result bhejo
    await fetch(decodeURIComponent(callback_url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return res.json({ status: "sent", result: payload.status });

  } catch (err) {
    return res.json({ status: "error", message: err.message });
  }
}
