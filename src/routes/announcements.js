const express = require('express');
const pool = require('../db/pool');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// 公開：已發布公告
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM announcements WHERE status = 'published'
       AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
       ORDER BY publish_date DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：所有公告
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM announcements ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：新增公告
router.post('/', authenticateAdmin, async (req, res) => {
  const { title, content, priority, status, publish_date, expiry_date, author } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO announcements (title, content, priority, status, publish_date, expiry_date, author)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, content, priority || 'medium', status || 'draft', publish_date || null, expiry_date || null, author]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：更新公告
router.put('/:id', authenticateAdmin, async (req, res) => {
  const { title, content, priority, status, publish_date, expiry_date, author } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE announcements SET
         title = COALESCE($1, title),
         content = COALESCE($2, content),
         priority = COALESCE($3, priority),
         status = COALESCE($4, status),
         publish_date = COALESCE($5, publish_date),
         expiry_date = COALESCE($6, expiry_date),
         author = COALESCE($7, author),
         updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [title, content, priority, status, publish_date, expiry_date, author, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: '找不到此公告' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：刪除公告
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM announcements WHERE id = $1`, [req.params.id]);
    res.json({ message: '公告已刪除' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

module.exports = router;
