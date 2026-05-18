const express = require('express');
const pool = require('../db/pool');
const { authenticateUser, authenticateAdmin } = require('../middleware/auth');
const { buildPaymentParams, parseNotify } = require('../lib/newebpay');

const router = express.Router();

// 用戶：建立付款（取得藍新金流參數）
router.post('/initiate', authenticateUser, async (req, res) => {
  const { order_id } = req.body;

  try {
    const { rows } = await pool.query(
      `SELECT o.*, i.title FROM orders o
       LEFT JOIN itineraries i ON o.itinerary_id = i.id
       WHERE o.id = $1 AND o.user_id = $2`,
      [order_id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: '找不到此訂單' });

    const order = rows[0];
    if (order.payment_status !== 'unpaid') {
      return res.status(400).json({ message: '此訂單已付款或處理中' });
    }

    const params = buildPaymentParams({
      order_no: order.order_no,
      total_price: order.total_price,
      title: order.title || '行程報名',
      email: order.contact_email,
    });

    if (!params) {
      // 藍新未設定，回傳 mock
      return res.json({
        mock: true,
        message: '藍新金流尚未設定，此為模擬付款',
        order_no: order.order_no,
        amount: order.total_price,
      });
    }

    // 記錄付款嘗試
    await pool.query(
      `INSERT INTO payments (order_id, merchant_order_no, amount, status)
       VALUES ($1, $2, $3, 'pending')`,
      [order.id, order.order_no, order.total_price]
    );

    res.json(params);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 藍新金流：付款結果通知（Server to Server）
router.post('/notify', express.urlencoded({ extended: true }), async (req, res) => {
  const { TradeInfo } = req.body;

  try {
    const result = parseNotify(TradeInfo);
    if (!result) return res.send('0|NotConfigured');

    const { MerchantOrderNo, TradeNo, Amt, Status } = result;
    const paid = Status === 'SUCCESS';

    await pool.query(
      `UPDATE payments SET status = $1, trade_no = $2, response_data = $3, updated_at = NOW()
       WHERE merchant_order_no = $4`,
      [paid ? 'paid' : 'failed', TradeNo, result, MerchantOrderNo]
    );

    if (paid) {
      await pool.query(
        `UPDATE orders SET payment_status = 'paid', status = 'confirmed', updated_at = NOW()
         WHERE order_no = $1`,
        [MerchantOrderNo]
      );
    }

    res.send('1|OK');
  } catch (err) {
    console.error(err);
    res.send('0|Error');
  }
});

// 模擬付款成功（開發測試用）
router.post('/mock-pay', authenticateUser, async (req, res) => {
  const { order_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE orders SET payment_status = 'paid', status = 'confirmed', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [order_id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: '找不到此訂單' });
    res.json({ message: '模擬付款成功', order: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：查看所有金流記錄
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, o.order_no, o.status as order_status, u.name as user_name
       FROM payments p
       LEFT JOIN orders o ON p.order_id = o.id
       LEFT JOIN users u ON o.user_id = u.id
       ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

module.exports = router;
