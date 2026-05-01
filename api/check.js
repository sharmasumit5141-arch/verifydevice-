const mongoose = require('mongoose');

// Define Schema
const DeviceSchema = new mongoose.Schema({
    tgid: String,
    botid: String,
    deviceid: String
});

const Device = mongoose.models.Device || mongoose.model('Device', DeviceSchema);

// DB Connection
const connectDB = async () => {
    if (mongoose.connections[0].readyState) return;
    await mongoose.connect(process.env.MONGO_URI);
};

export default async function handler(req, res) {
    await connectDB();
    const { botid, tgid, deviceid } = req.query;

    if (!botid || !tgid || !deviceid) {
        return res.status(400).json({ success: false, message: "Missing data" });
    }

    try {
        // Find if this device is already registered to THIS bot
        const existingDevice = await Device.findOne({ botid, deviceid });

        if (existingDevice) {
            // Check if the TG ID matches the one already saved for this device
            if (existingDevice.tgid === tgid) {
                return res.json({ success: true, message: "Device already verified" });
            } else {
                return res.json({ success: false, message: "Device already linked to another account on this bot" });
            }
        }

        // Check if this TG ID is already registered to THIS bot on a different device (Optional)
        const existingUser = await Device.findOne({ botid, tgid });
        if (existingUser) {
            return res.json({ success: true, message: "User already verified" });
        }

        // New Registration
        const newEntry = new Device({ tgid, botid, deviceid });
        await newEntry.save();
        
        return res.json({ success: true, message: "New device verified successfully" });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
