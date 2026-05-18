const pool = require('../db/pool');

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

async function sendOtp(phone) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await pool.query(
    `INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)`,
    [phone, code, expiresAt]
  );

  // TODO: 串接簡訊服務（Twilio / 三竹簡訊）
  // 目前只印在 console 供測試
  console.log(`[OTP MOCK] Phone: ${phone}, Code: ${code}`);

  return { success: true };
}

async function verifyOtp(phone, code) {
  const { rows } = await pool.query(
    `SELECT * FROM otp_codes
     WHERE phone = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, code]
  );

  if (rows.length === 0) return false;

  await pool.query(`UPDATE otp_codes SET used = TRUE WHERE id = $1`, [rows[0].id]);
  return true;
}

module.exports = { sendOtp, verifyOtp };
