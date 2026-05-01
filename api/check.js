const mongoose = require('mongoose');

// Schema to store the link between Device, Bot, and Telegram User
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

    // SCENARIO: User hasn't opened the link yet (No deviceid sent by bot check)
    if (!deviceid) {
        const record = await Auth.findOne({ botid, tgid });
        if (!record) {
            return res.json({ status: "pending", message: "User has not opened the verification page." });
        }
        return res.json({ status: "success", message: "User is already verified." });
    }

    try {
        // Find if this device is already registered for this specific bot
        const existingDevice = await Auth.findOne({ botid, deviceid });

        if (existingDevice) {
            // SUCCESS: Same device, same tgid
            if (existingDevice.tgid === tgid) {
                return res.json({ status: "success", message: "Device verified." });
            } 
            // FAIL: Same device, but a DIFFERENT tgid (Multi-account attempt)
            else {
                return res.json({ status: "fail", message: "This device is already linked to another Telegram account." });
            }
        }

        // NEW USER: Bot ID same or new, but device is fresh
        const newAuth = new Auth({ tgid, botid, deviceid });
        await newAuth.save();
        return res.json({ status: "success", message: "New device registered successfully." });

    } catch (err) {
        return res.status(500).json({ status: "error", message: err.message });
    }
}
