const express = require('express');
const pool = require('../db/pool');
const { authenticateUser, authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

const generateOrderNo = () => `GT${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

// 用戶：建立訂單
router.post('/', authenticateUser, async (req, res) => {
  const { itinerary_id, quantity, contact_name, contact_email, contact_phone, note } = req.body;
  if (!itinerary_id) return res.status(400).json({ message: '請選擇行程' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: itin } = await client.query(
      `SELECT * FROM itineraries WHERE id = $1 AND status = 'published' FOR UPDATE`,
      [itinerary_id]
    );
    if (itin.length === 0) return res.status(404).json({ message: '找不到此行程' });

    const itinerary = itin[0];
    const qty = quantity || 1;

    if (itinerary.available_seats < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: '剩餘名額不足' });
    }

    const totalPrice = itinerary.price * qty;
    const orderNo = generateOrderNo();

    const { rows } = await client.query(
      `INSERT INTO orders (order_no, user_id, itinerary_id, quantity, unit_price, total_price, contact_name, contact_email, contact_phone, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [orderNo, req.user.id, itinerary_id, qty, itinerary.price, totalPrice, contact_name, contact_email, contact_phone, note]
    );

    await client.query(
      `UPDATE itineraries SET available_seats = available_seats - $1 WHERE id = $2`,
      [qty, itinerary_id]
    );

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  } finally {
    client.release();
  }
});

// 用戶：取得自己的訂單
router.get('/my', authenticateUser, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, i.title as itinerary_title, i.destination, i.start_date, i.end_date
       FROM orders o
       LEFT JOIN itineraries i ON o.itinerary_id = i.id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 用戶：取得單一訂單
router.get('/my/:id', authenticateUser, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, i.title as itinerary_title, i.destination, i.start_date, i.end_date
       FROM orders o
       LEFT JOIN itineraries i ON o.itinerary_id = i.id
       WHERE o.id = $1 AND o.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: '找不到此訂單' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 用戶：修改付款方式（僅限未付款訂單）
router.patch('/my/:id/payment-method', authenticateUser, async (req, res) => {
  const { payment_method } = req.body;
  const allowed = ['credit_card', 'atm', 'web_atm', 'cvs'];
  if (!payment_method || !allowed.includes(payment_method)) {
    return res.status(400).json({ message: '無效的付款方式' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE orders SET payment_method = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 AND payment_status = 'unpaid'
       RETURNING *`,
      [payment_method, req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: '找不到可修改的訂單（已付款或不存在）' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：取得所有訂單（含報名個資）
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*,
              i.title as itinerary_title,
              u.name as user_name, u.email as user_email,
              r.id as reg_id, r.id_number, r.birthday, r.gender,
              r.custom_field_data, r.note as reg_note, r.status as reg_status
       FROM orders o
       LEFT JOIN itineraries i ON o.itinerary_id = i.id
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN registrations r ON r.order_id = o.id
       ORDER BY o.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：更新訂單狀態
router.patch('/admin/:id', authenticateAdmin, async (req, res) => {
  const { status, payment_status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE orders SET
         status = COALESCE($1, status),
         payment_status = COALESCE($2, payment_status),
         updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, payment_status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: '找不到此訂單' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

module.exports = router;
