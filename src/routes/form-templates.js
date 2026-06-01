const express = require('express');
const pool = require('../db/pool');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// 後台：取得所有模板
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM form_templates ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：新增模板
router.post('/', authenticateAdmin, async (req, res) => {
  const { name, description, fields } = req.body;
  if (!name) return res.status(400).json({ message: '請輸入模板名稱' });
  if (!Array.isArray(fields)) return res.status(400).json({ message: 'fields 必須為陣列' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO form_templates (name, description, fields)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, description || null, JSON.stringify(fields)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：更新模板
router.put('/:id', authenticateAdmin, async (req, res) => {
  const { name, description, fields } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE form_templates SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         fields = COALESCE($3, fields),
         updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name, description, fields ? JSON.stringify(fields) : null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: '找不到此模板' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// 後台：刪除模板
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM form_templates WHERE id = $1`, [req.params.id]);
    res.json({ message: '模板已刪除' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

module.exports = router;
