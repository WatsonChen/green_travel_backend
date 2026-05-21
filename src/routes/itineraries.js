const express = require('express');
const pool = require('../db/pool');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// 公開：已上架行程
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, destination, description, start_date, end_date, price,
              available_seats, max_seats, waitlist_enabled, venue, cover_image, tags,
              registration_open_at, registration_close_at
       FROM itineraries WHERE status = 'published' ORDER BY start_date ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 公開：單一行程（含報名表格設定）
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM itineraries WHERE id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: '找不到此行程' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：取得所有行程
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM itineraries ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：新增行程（Step 1 - 活動設定）
router.post('/', authenticateAdmin, async (req, res) => {
  const {
    title, destination, description,
    start_date, end_date, price,
    max_seats, waitlist_enabled, waitlist_limit,
    registration_open_at, registration_close_at,
    venue, venue_description,
    confirmation_message, notification_email,
    status, tags,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO itineraries (
         title, destination, description,
         start_date, end_date, price,
         max_seats, available_seats, waitlist_enabled, waitlist_limit,
         registration_open_at, registration_close_at,
         venue, venue_description,
         confirmation_message, notification_email,
         status, tags
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        title, destination, description || null,
        start_date, end_date, price,
        max_seats || 20, waitlist_enabled || false, waitlist_limit || null,
        registration_open_at || null, registration_close_at || null,
        venue || null, venue_description || null,
        confirmation_message || null, notification_email || null,
        status || 'draft', tags || [],
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：更新行程（支援分步驟儲存）
router.put('/:id', authenticateAdmin, async (req, res) => {
  const {
    title, destination, description,
    start_date, end_date, price,
    max_seats, waitlist_enabled,
    registration_open_at, registration_close_at,
    venue, venue_description,
    cover_image, custom_fields,
    confirmation_message, notification_email,
    status, tags,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE itineraries SET
         title = COALESCE($1, title),
         destination = COALESCE($2, destination),
         description = COALESCE($3, description),
         start_date = COALESCE($4, start_date),
         end_date = COALESCE($5, end_date),
         price = COALESCE($6, price),
         max_seats = COALESCE($7, max_seats),
         waitlist_enabled = COALESCE($8, waitlist_enabled),
         registration_open_at = $9,
         registration_close_at = $10,
         venue = COALESCE($11, venue),
         venue_description = COALESCE($12, venue_description),
         cover_image = COALESCE($13, cover_image),
         custom_fields = COALESCE($14, custom_fields),
         confirmation_message = COALESCE($15, confirmation_message),
         notification_email = COALESCE($16, notification_email),
         status = COALESCE($17, status),
         tags = COALESCE($18, tags),
         updated_at = NOW()
       WHERE id = $19
       RETURNING *`,
      [
        title, destination, description,
        start_date, end_date, price,
        max_seats, waitlist_enabled,
        registration_open_at ?? null, registration_close_at ?? null,
        venue, venue_description,
        cover_image, custom_fields ? JSON.stringify(custom_fields) : null,
        confirmation_message, notification_email,
        status, tags,
        req.params.id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ message: '找不到此行程' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：刪除行程
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM itineraries WHERE id = $1`, [req.params.id]);
    res.json({ message: '行程已刪除' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

module.exports = router;
