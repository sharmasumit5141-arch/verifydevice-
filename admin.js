const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI;
const ADMIN_KEY = process.env.ADMIN_KEY || "unio8435";

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    const { key, botid, action } = req.method === "GET" ? req.query : req.body;

    if (key !== ADMIN_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    if (!botid) {
        return res.status(400).json({ error: "botid required" });
    }

    let client;
    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        const col = client.db("device_verify").collection("lifafa_config");

        // ── GET config ──
        if (req.method === "GET" || action === "get") {
            const config = await col.findOne({ botid: botid });
            return res.status(200).json({ success: true, config: config || {} });
        }

        // ── Set channels ──
        if (action === "set_channels") {
            const { channels } = req.body;
            await col.updateOne(
                { botid: botid },
                { $set: { botid: botid, channels: channels, updated_at: new Date() } },
                { upsert: true }
            );
            return res.status(200).json({ success: true, message: "Channels saved!" });
        }

        // ── Set reward (link ya code) ──
        if (action === "set_reward") {
            const { reward_type, reward_value, reward_title } = req.body;
            await col.updateOne(
                { botid: botid },
                {
                    $set: {
                        botid: botid,
                        reward_type: reward_type,
                        reward_value: reward_value,
                        reward_title: reward_title || "Your Reward",
                        updated_at: new Date()
                    }
                },
                { upsert: true }
            );
            return res.status(200).json({ success: true, message: "Reward saved!" });
        }

        // ── Set both ──
        if (action === "set_all") {
            const { channels, reward_type, reward_value, reward_title } = req.body;
            await col.updateOne(
                { botid: botid },
                {
                    $set: {
                        botid: botid,
                        channels: channels,
                        reward_type: reward_type,
                        reward_value: reward_value,
                        reward_title: reward_title || "Your Reward",
                        updated_at: new Date()
                    }
                },
                { upsert: true }
            );
            return res.status(200).json({ success: true, message: "Config saved!" });
        }

        return res.status(400).json({ error: "Invalid action" });

    } catch (err) {
        return res.status(500).json({ error: "Server error: " + err.message });
    } finally {
        if (client) await client.close();
    }
}
