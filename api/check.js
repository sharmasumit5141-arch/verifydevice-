const mongoose = require('mongoose');

const AuthSchema = new mongoose.Schema({
    tgid: String,
    botid: String,
    deviceid: String,
    verifiedAt: { type: Date, default: Date.now }
});

const Auth = mongoose.models.Auth || mongoose.model('Auth', AuthSchema);

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    await mongoose.connect(process.env.MONGO_URI);
};

export default async function handler(req, res) {
    await connectDB();
    const { botid, tgid, deviceid } = req.query;

    if (!botid || !tgid) {
        return res.status(400).json({ status: "fail", message: "Invalid Request" });
    }

    // Bot checking status (Link not opened yet or checking from Bot)
    if (!deviceid) {
        const record = await Auth.findOne({ botid, tgid });
        return record 
            ? res.json({ status: "success", message: "Verified" }) 
            : res.json({ status: "pending", message: "Not Opened" });
    }

    try {
        // 1. Check if THIS device is already used by SOMEONE ELSE on this bot
        const deviceUsedByOther = await Auth.findOne({ botid, deviceid, tgid: { $ne: tgid } });
        
        if (deviceUsedByOther) {
            return res.json({ 
                status: "fail", 
                message: "Security Alert: Hardware already linked to another account." 
            });
        }

        // 2. Check if THIS user is already verified
        const existingUser = await Auth.findOne({ botid, tgid });
        if (existingUser) {
            // Update device ID if it changed (optional, but keep it strict for now)
            return res.json({ status: "success", message: "Device Verified" });
        }

        // 3. New User + New Device -> Save
        const newEntry = new Auth({ tgid, botid, deviceid });
        await newEntry.save();
        return res.json({ status: "success", message: "Verification Successful" });

    } catch (err) {
        return res.status(500).json({ status: "error", message: "Server Error" });
    }
}
