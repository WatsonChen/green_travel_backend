const express = require('express');
const pool = require('../db/pool');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// 後台：取得所有報名表單
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, i.title as itinerary_title
       FROM registrations r
       LEFT JOIN itineraries i ON r.itinerary_id = i.id
       ORDER BY r.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 公開/用戶：提交報名（不需登入，舊有功能保留）
router.post('/', async (req, res) => {
  const { itinerary_id, applicant_name, email, phone, id_number, note } = req.body;
  if (!applicant_name || !email) return res.status(400).json({ message: '請填寫姓名和 Email' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO registrations (itinerary_id, applicant_name, email, phone, id_number, note)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [itinerary_id || null, applicant_name, email, phone || null, id_number || null, note || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：更新報名狀態
router.patch('/:id', authenticateAdmin, async (req, res) => {
  const { status, note } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE registrations SET
         status = COALESCE($1, status),
         note = COALESCE($2, note)
       WHERE id = $3 RETURNING *`,
      [status, note, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: '找不到此報名' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：刪除報名
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM registrations WHERE id = $1`, [req.params.id]);
    res.json({ message: '報名已刪除' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

module.exports = router;
