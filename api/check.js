const mongoose = require('mongoose');

// Schemas
const AuthSchema = new mongoose.Schema({
    tgid: String, botid: String, deviceid: String,
    verifiedAt: { type: Date, default: Date.now }
});

const FailLogSchema = new mongoose.Schema({
    attemptedTgid: String, originalTgid: String, botid: String,
    deviceid: String, timestamp: { type: Date, default: Date.now },
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

    if (!botid || !tgid) return res.status(400).json({ status: "fail", message: "Missing Parameters" });

    // Bot check (without deviceid)
    if (!deviceid) {
        const record = await Auth.findOne({ botid, tgid });
        return record ? res.json({ status: "success", message: "Verified" }) : res.json({ status: "pending", message: "Not Opened" });
    }

    try {
        // 1. DATABASE CHECK: Kya ye deviceid kisi aur tgid ke paas hai?
        const hardwareCheck = await Auth.findOne({ botid, deviceid });

        if (hardwareCheck) {
            // Agar hardware mil gaya lekin TGID alag hai -> CHEATER DETECTED
            if (hardwareCheck.tgid !== tgid) {
                
                // Pehle check karo kya is cheater ka log pehle se saved hai? (Duplication rokne ke liye)
                const alreadyLogged = await FailLog.findOne({ attemptedTgid: tgid, deviceid });
                
                if (!alreadyLogged) {
                    const logFail = new FailLog({
                        attemptedTgid: tgid,
                        originalTgid: hardwareCheck.tgid,
                        botid: botid,
                        deviceid: deviceid,
                        reason: "Hardware ID Conflict (Multi-Account)"
                    });
                    await logFail.save();
                }

                return res.json({ 
                    status: "fail", 
                    message: "Security Alert: This hardware is locked to another account." 
                });
            } else {
                // Same hardware, same user -> Already Verified
                return res.json({ status: "success", message: "Verified" });
            }
        }

        // 2. AGAR HARDWARE NAYA HAI: Toh check karo kya ye TGID pehle kisi aur hardware se verify toh nahi hua?
        const userCheck = await Auth.findOne({ botid, tgid });
        if (userCheck) {
            return res.json({ status: "success", message: "User already verified" });
        }

        // 3. SAB KUCH SAHI HAI: Toh naya record save karo
        const newAuth = new Auth({ tgid, botid, deviceid });
        await newAuth.save();
        return res.json({ status: "success", message: "Verification Successful" });

    } catch (err) {
        return res.status(500).json({ status: "error", message: "DB Error" });
    }
                                  }
