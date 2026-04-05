const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI;

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { device_id, tg_id, tg_name, bot_id } = req.body;

    if (!device_id || !tg_id || !bot_id) {
        return res.status(400).json({ error: "Missing fields" });
    }

    let client;
    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        const col = client.db("device_verify").collection("devices");

        const existing = await col.findOne({ device_id: device_id, bot_id: bot_id });

        if (existing) {
            if (existing.tg_id === tg_id) {
                return res.status(200).json({ status: "already_mine" });
            } else {
                return res.status(200).json({ status: "failed" });
            }
        } else {
            await col.insertOne({
                device_id: device_id,
                tg_id: tg_id,
                tg_name: tg_name || "User",
                bot_id: bot_id,
                created_at: new Date()
            });
            return res.status(200).json({ status: "success" });
        }
    } catch (err) {
        return res.status(500).json({ error: "Server error" });
    } finally {
        if (client) await client.close();
    }
}
