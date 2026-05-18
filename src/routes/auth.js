const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { sendOtp, verifyOtp } = require('../lib/otp');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// ── 用戶：Email 註冊 ──────────────────────────────────────────
router.post('/user/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!email && !phone) return res.status(400).json({ message: '請提供 Email 或電話' });
  if (email && !password) return res.status(400).json({ message: '請提供密碼' });

  try {
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone, status, created_at`,
      [name, email || null, phone || null, passwordHash]
    );
    const token = jwt.sign({ id: rows[0].id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Email 或電話已被使用' });
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// ── 用戶：Email 登入 ──────────────────────────────────────────
router.post('/user/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: '請輸入 Email 和密碼' });

  try {
    const { rows } = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ message: 'Email 或密碼錯誤' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Email 或密碼錯誤' });

    const token = jwt.sign({ id: user.id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// ── 用戶：發送手機 OTP ────────────────────────────────────────
router.post('/user/otp/send', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: '請提供電話號碼' });

  try {
    await sendOtp(phone);
    res.json({ message: 'OTP 已發送' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '發送失敗' });
  }
});

// ── 用戶：手機 OTP 登入/註冊 ──────────────────────────────────
router.post('/user/otp/verify', async (req, res) => {
  const { phone, code, name } = req.body;
  if (!phone || !code) return res.status(400).json({ message: '請提供電話和驗證碼' });

  const valid = await verifyOtp(phone, code);
  if (!valid) return res.status(401).json({ message: '驗證碼錯誤或已過期' });

  try {
    let { rows } = await pool.query(`SELECT * FROM users WHERE phone = $1`, [phone]);
    let user = rows[0];

    if (!user) {
      const inserted = await pool.query(
        `INSERT INTO users (name, phone, phone_verified) VALUES ($1, $2, TRUE)
         RETURNING id, name, email, phone, status, created_at`,
        [name || phone, phone]
      );
      user = inserted.rows[0];
    } else {
      await pool.query(`UPDATE users SET phone_verified = TRUE WHERE id = $1`, [user.id]);
    }

    const token = jwt.sign({ id: user.id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// ── 用戶：忘記密碼（發 Email）────────────────────────────────
router.post('/user/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: '請提供 Email' });

  try {
    const { rows } = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    // 不論是否存在都回成功，避免枚舉攻擊
    if (rows.length > 0) {
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
        [rows[0].id, token, expiresAt]
      );
      // TODO: 寄送重設信（串接 nodemailer / SendGrid）
      console.log(`[PASSWORD RESET MOCK] Token: ${token}`);
    }
    res.json({ message: '若此 Email 存在，重設連結已發送' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// ── 用戶：重設密碼 ────────────────────────────────────────────
router.post('/user/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: '缺少必要欄位' });

  try {
    const { rows } = await pool.query(
      `SELECT * FROM password_reset_tokens WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
      [token]
    );
    if (rows.length === 0) return res.status(400).json({ message: '連結無效或已過期' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, rows[0].user_id]);
    await pool.query(`UPDATE password_reset_tokens SET used = TRUE WHERE id = $1`, [rows[0].id]);
    res.json({ message: '密碼已重設' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// ── 用戶：取得自己的資料 ──────────────────────────────────────
router.get('/user/me', authenticateUser, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, status, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: '找不到用戶' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// ── 用戶：更新個人資料 ────────────────────────────────────────
router.patch('/user/me', authenticateUser, async (req, res) => {
  const { name, email, phone } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email),
       phone = COALESCE($3, phone), updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, email, phone, status, created_at`,
      [name, email, phone, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Email 或電話已被使用' });
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// ── 管理員：登入 ──────────────────────────────────────────────
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: '請輸入帳號和密碼' });

  try {
    const { rows } = await pool.query(`SELECT * FROM admins WHERE email = $1`, [email]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ message: '帳號或密碼錯誤' });

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ message: '帳號或密碼錯誤' });

    const token = jwt.sign({ id: admin.id, role: admin.role }, process.env.ADMIN_JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// ── 管理員：建立初始帳號（僅開發使用，正式環境請移除或加保護）──
router.post('/admin/seed', async (req, res) => {
  const { email, password, name, secret } = req.body;
  if (secret !== process.env.ADMIN_JWT_SECRET) return res.status(403).json({ message: 'Forbidden' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO admins (email, password_hash, name) VALUES ($1, $2, $3)
       RETURNING id, email, name, role`,
      [email, hash, name || 'Admin']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: '此 Email 已存在' });
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

module.exports = router;
