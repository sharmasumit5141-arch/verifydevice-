// api/check.js
const { getDb } = require('../lib/mongo');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Support both GET query params and POST body
  const botid = req.query.botid || req.body?.botid;
  const tgid  = req.query.tgid  || req.body?.tgid;
  const deviceId = req.query.deviceid || req.body?.deviceid;

  if (!botid || !tgid) {
    return res.status(400).json({
      status: 'error',
      code: 400,
      message: 'botid and tgid are required'
    });
  }

  try {
    const db = await getDb();
    // Each bot gets its own collection: bot_987654321
    const col = db.collection(`bot_${botid}`);

    // Find record by tgid
    const record = await col.findOne({ tgid: String(tgid) });

    // ─── PENDING: tgid never visited verification page ───────────────────
    if (!record) {
      return res.status(200).json({
        status: 'pending',
        code: 202,
        message: 'User has not started verification yet',
        tgid,
        botid
      });
    }

    // ─── SUCCESS case 1: Same tgid, different botid (bot changed) ────────
    // ─── SUCCESS case 2: New tgid + new botid combo ───────────────────────
    // ─── FAIL: Same botid + same deviceId but different tgid ─────────────

    const deviceMatches  = record.deviceId === deviceId;
    const botMatches     = record.botid    === String(botid);

    // Check if another tgid already owns this deviceId+botid combo
    if (deviceId) {
      const sameDevice = await col.findOne({
        deviceId: deviceId,
        botid: String(botid),
        tgid: { $ne: String(tgid) }
      });

      if (sameDevice) {
        return res.status(200).json({
          status: 'fail',
          code: 403,
          message: 'Device already registered to a different Telegram account',
          tgid,
          botid,
          registered_tgid: sameDevice.tgid
        });
      }
    }

    // All good — success
    return res.status(200).json({
      status: 'success',
      code: 200,
      message: 'Device verification successful',
      tgid,
      botid,
      deviceId: record.deviceId,
      verified_at: record.createdAt
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Internal server error',
      detail: err.message
    });
  }
};
