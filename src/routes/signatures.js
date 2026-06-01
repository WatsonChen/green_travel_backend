const express = require('express');
const pool = require('../db/pool');
const { authenticateUser, authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// 用戶：儲存電子簽名
router.post('/', authenticateUser, async (req, res) => {
  const { order_id, signer_name, signature_data, contract_snapshot } = req.body;
  if (!order_id || !signature_data) {
    return res.status(400).json({ message: '缺少 order_id 或 signature_data' });
  }

  try {
    // 確認訂單屬於此用戶
    const { rows: orderRows } = await pool.query(
      `SELECT id FROM orders WHERE id = $1 AND user_id = $2`,
      [order_id, req.user.id]
    );
    if (orderRows.length === 0) return res.status(403).json({ message: '無權限' });

    // 如已存在則更新（重複送出保護）
    const existing = await pool.query(
      `SELECT id FROM signatures WHERE order_id = $1`,
      [order_id]
    );
    let result;
    if (existing.rows.length > 0) {
      const { rows } = await pool.query(
        `UPDATE signatures SET signer_name = $1, signature_data = $2, contract_snapshot = $3, signed_at = NOW()
         WHERE order_id = $4 RETURNING *`,
        [signer_name || null, signature_data, contract_snapshot || null, order_id]
      );
      result = rows[0];
    } else {
      const { rows } = await pool.query(
        `INSERT INTO signatures (order_id, signer_name, signature_data, contract_snapshot)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [order_id, signer_name || null, signature_data, contract_snapshot || null]
      );
      result = rows[0];
    }
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：查詢訂單簽名
router.get('/order/:order_id', authenticateAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM signatures WHERE order_id = $1`,
      [req.params.order_id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

module.exports = router;
