const mongoose = require('mongoose');

// Schema for Successful Verifications
const AuthSchema = new mongoose.Schema({
    tgid: String,
    botid: String,
    deviceid: String,
    verifiedAt: { type: Date, default: Date.now }
});

// Schema for Cheating Attempts (Fail Logs)
const FailLogSchema = new mongoose.Schema({
    attemptedTgid: String,
    originalTgid: String,
    botid: String,
    deviceid: String,
    timestamp: { type: Date, default: Date.now },
    reason: String
});

const Auth = mongoose.models.Auth || mongoose.model('Auth', AuthSchema);
const FailLog = mongoose.models.FailLog || mongoose.model('FailLog', FailLogSchema);

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    await mongoose.connect(process.env.MONGO_URI);
};

export default async function handler(req, res) {
    await connectDB();
    const { botid, tgid, deviceid } = req.query;

    if (!botid || !tgid) {
        return res.status(400).json({ status: "fail", message: "Missing Parameters" });
    }

    // Bot status check (When no deviceid is sent)
    if (!deviceid) {
        const record = await Auth.findOne({ botid, tgid });
        if (record) return res.json({ status: "success", message: "Verified" });
        return res.json({ status: "pending", message: "Not Opened" });
    }

    try {
        // 1. HARDWARE LOCK LOGIC (Fail Case)
        const hardwareLocked = await Auth.findOne({ botid, deviceid });

        if (hardwareLocked) {
            if (hardwareLocked.tgid !== tgid) {
                // SAVE THE FRAUD ATTEMPT
                const logFail = new FailLog({
                    attemptedTgid: tgid,
                    originalTgid: hardwareLocked.tgid,
                    botid: botid,
                    deviceid: deviceid,
                    reason: "Multi-account detected on same hardware"
                });
                await logFail.save();

                return res.json({ 
                    status: "fail", 
                    message: "Security Alert: This device is already linked to another account." 
                });
            } else {
                return res.json({ status: "success", message: "Device Verified" });
            }
        }

        // 2. NEW REGISTRATION
        const userExists = await Auth.findOne({ botid, tgid });
        if (userExists) return res.json({ status: "success", message: "User already verified" });

        const newAuth = new Auth({ tgid, botid, deviceid });
        await newAuth.save();
        return res.json({ status: "success", message: "Verification Successful" });

    } catch (err) {
        return res.status(500).json({ status: "error", message: "Server Error" });
    }
    }
