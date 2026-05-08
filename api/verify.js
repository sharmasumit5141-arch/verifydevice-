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

  const { bot_hash, fingerprint, tg_user_id, user_hash } = req.body;

  if (!bot_hash) return res.json({ status: "error", message: "Missing bot_hash" });

  try {
    const db = await connectDB();

    const session = await db.collection("sessions").findOne({ botHash: bot_hash });
    if (!session) return res.json({ status: "invalid", message: "Session not found" });

    // Bot name session se lo
    const bot_name = session.bot || "unknown";

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      req.socket?.remoteAddress || "";

    const vpnStatus = await checkVPN(ip);

    let resultStatus = "success";

    if (fingerprint && tg_user_id) {

      // Same device + Same TG + Same Bot = Already Verified
      const alreadyVerified = await db.collection("fingerprints").findOne({
        fingerprint,
        tg_user_id,
        bot_name
      });

      if (alreadyVerified) {
        resultStatus = "already_verified";

      } else {
        // Same device + alag TG + Same Bot = same_device
        const sameDevice = await db.collection("fingerprints").findOne({
          fingerprint,
          bot_name
        });

        if (sameDevice) {
          resultStatus = "same_device";
        } else {
          // Bilkul naya = save karo (bot_name bhi save hoga)
          await db.collection("fingerprints").insertOne({
            fingerprint,
            tg_user_id,
            bot_name,
            bot_hash,
            ip,
            createdAt: new Date(),
          });
          resultStatus = "success";
        }
      }
    }

    await db.collection("sessions").updateOne(
      { botHash: bot_hash },
      { $set: { status: "verified", verifiedAt: new Date(), ip, fingerprint, tg_user_id } }
    );

    let payload;

    if (vpnStatus === "yes") {
      payload = {
        status: "fail",
        vpn: "yes",
        captcha: "fail",
        user_hash: user_hash || bot_hash,
        title: "VPN Detected",
        message: "VPN use is not allowed.",
      };
    } else if (resultStatus === "already_verified") {
      payload = {
        status: "already_verified",
        vpn: "no",
        captcha: "ok",
        user_hash: user_hash || bot_hash,
        title: "Already Verified",
        message: "You are already verified.",
      };
    } else if (resultStatus === "same_device") {
      payload = {
        status: "same_device",
        vpn: "no",
        captcha: "ok",
        user_hash: user_hash || bot_hash,
        title: "Same Device",
        message: "Same device detected.",
      };
    } else {
      payload = {
        status: "success",
        vpn: "no",
        captcha: "ok",
        user_hash: user_hash || bot_hash,
        title: "Verified",
        message: "User verified successfully.",
      };
    }

    await fetch(session.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return res.json({ status: "sent", result: payload.status });
  } catch (err) {
    return res.json({ status: "error", message: err.message });
  }
}
