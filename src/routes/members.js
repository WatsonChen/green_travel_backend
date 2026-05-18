const express = require('express');
const pool = require('../db/pool');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// 後台：取得所有會員
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, status, created_at FROM users ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：取得單一會員
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, status, created_at FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: '找不到此會員' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：更新會員狀態/資料
router.patch('/:id', authenticateAdmin, async (req, res) => {
  const { name, email, phone, status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET
         name = COALESCE($1, name),
         email = COALESCE($2, email),
         phone = COALESCE($3, phone),
         status = COALESCE($4, status),
         updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, email, phone, status, created_at`,
      [name, email, phone, status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: '找不到此會員' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Email 或電話已被使用' });
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：停用會員
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await pool.query(`UPDATE users SET status = 'inactive' WHERE id = $1`, [req.params.id]);
    res.json({ message: '會員已停用' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

module.exports = router;
