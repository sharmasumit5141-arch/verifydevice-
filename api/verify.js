import { connectDB } from "./_db.js";

// ── VPN/Proxy detection via ip-api.com (free tier) ──────────────────────────
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

  const { bot_hash, fingerprint, user_hash } = req.body;

  if (!bot_hash) return res.json({ status: "error", message: "Missing bot_hash" });

  try {
    const db = await connectDB();

    // Get session
    const session = await db.collection("sessions").findOne({ botHash: bot_hash });
    if (!session) return res.json({ status: "invalid", message: "Session not found" });

    // Get real IP
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "";

    const vpnStatus = await checkVPN(ip);

    // Check same device fingerprint
    let sameDevice = false;
    if (fingerprint) {
      const existing = await db.collection("fingerprints").findOne({ fingerprint });
      if (existing) {
        sameDevice = true;
      } else {
        await db.collection("fingerprints").insertOne({
          fingerprint,
          bot_hash,
          ip,
          createdAt: new Date(),
        });
      }
    }

    // Mark session verified
    await db.collection("sessions").updateOne(
      { botHash: bot_hash },
      { $set: { status: "verified", verifiedAt: new Date(), ip, fingerprint } }
    );

    // Build payload for bot webhook
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
    } else if (sameDevice) {
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

    // Call bot webhook
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
