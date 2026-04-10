const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI;

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { botid, tg_id } = req.body;

    if (!botid || !tg_id) {
        return res.status(400).json({ error: "Missing fields" });
    }

    let client;
    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        const db = client.db("device_verify");
        const configCol = db.collection("lifafa_config");
        const claimCol = db.collection("lifafa_claims");

        // Config lo
        const config = await configCol.findOne({ botid: botid });
        if (!config) {
            return res.status(200).json({ error: "Config not found" });
        }

        // Already claimed check
        const claimed = await claimCol.findOne({ botid: botid, tg_id: tg_id });
        if (claimed) {
            return res.status(200).json({
                success: true,
                already_claimed: true,
                reward_type: config.reward_type || "code",
                reward_value: config.reward_value || "",
                reward_title: config.reward_title || "Your Reward",
                channels: config.channels || []
            });
        }

        return res.status(200).json({
            success: true,
            already_claimed: false,
            channels: config.channels || [],
            reward_type: config.reward_type || "code",
            reward_title: config.reward_title || "Your Reward"
        });

    } catch (err) {
        return res.status(500).json({ error: "Server error" });
    } finally {
        if (client) await client.close();
    }
}
