require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// データベース接続
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// データベース接続確認
pool.connect((err, client, release) => {
  if (err) {
    console.error('データベース接続エラー:', err.stack);
  } else {
    console.log('データベース接続成功');
    release();
  }
});

// ========================================
// 社員関連API
// ========================================

// 全社員取得（表示順）
app.get('/api/employees', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, department, name, display_order, created_at, updated_at FROM employees ORDER BY display_order ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// 社員追加
app.post('/api/employees', async (req, res) => {
  const { department, name } = req.body;
  
  if (!department || !name) {
    return res.status(400).json({ error: '所属と名前は必須です' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 最大display_orderを取得
    const maxOrder = await client.query(
      'SELECT COALESCE(MAX(display_order), 0) as max_order FROM employees'
    );
    const newOrder = maxOrder.rows[0].max_order + 1;

    // 社員追加
    const employeeResult = await client.query(
      'INSERT INTO employees (department, name, display_order) VALUES ($1, $2, $3) RETURNING *',
      [department, name, newOrder || 0]
    );

    // 行き先情報の初期レコード作成
    await client.query(
      'INSERT INTO whereabouts (employee_id, destination, return_time, remarks) VALUES ($1, $2, $3, $4)',
      [employeeResult.rows[0].id, '', '', '']
    );

    await client.query('COMMIT');
    res.status(201).json(employeeResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  } finally {
    client.release();
  }
});

// 社員並び替え
app.put('/api/employees/reorder', async (req, res) => {
  const { orders } = req.body; // [{ id: 1, display_order: 1 }, ...]

  if (!Array.isArray(orders)) {
    return res.status(400).json({ error: '不正なデータ形式です' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of orders) {
      await client.query(
        'UPDATE employees SET display_order = $1, updated_at = NOW() WHERE id = $2',
        [item.display_order, item.id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: '並び替えが完了しました' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  } finally {
    client.release();
  }
});

// 社員更新
app.put('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const { department, name } = req.body;

  if (!department || !name) {
    return res.status(400).json({ error: '所属と名前は必須です' });
  }

  try {
    const result = await pool.query(
      'UPDATE employees SET department = $1, name = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [department, name || 0, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '社員が見つかりません' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// 社員削除
app.delete('/api/employees/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM employees WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '社員が見つかりません' });
    }

    res.json({ message: '削除しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ========================================
// 行き先関連API
// ========================================

// 全行き先情報取得（社員情報含む）
app.get('/api/whereabouts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.id,
        e.department,
        e.name,
        e.display_order,
        COALESCE(w.destination, '') as destination,
        COALESCE(w.return_time, '') as return_time,
        COALESCE(w.remarks, '') as remarks,
        w.updated_at AT TIME ZONE 'Asia/Tokyo' as set_at
      FROM employees e
      LEFT JOIN whereabouts w ON e.id = w.employee_id
      ORDER BY e.display_order ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// 複数社員の行き先一括更新
app.put('/api/whereabouts/bulk', async (req, res) => {
  const { employeeIds, destination, return_time, remarks } = req.body;

  if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
    return res.status(400).json({ error: '社員IDが指定されていません' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const employeeId of employeeIds) {
      // 行き先更新
      await client.query(
        `UPDATE whereabouts 
         SET destination = $1, return_time = $2, remarks = $3, updated_at = NOW() 
         WHERE employee_id = $4`,
        [destination || '', return_time || '', remarks || '', employeeId]
      );

      // 履歴更新（行き先が空でない場合）
      if (destination && destination.trim() !== '') {
        await client.query(
          'DELETE FROM destination_history WHERE employee_id = $1 AND destination = $2',
          [employeeId, destination]
        );

        await client.query(
          'INSERT INTO destination_history (employee_id, destination, last_used_at) VALUES ($1, $2, NOW())',
          [employeeId, destination]
        );

        await client.query(
          `DELETE FROM destination_history 
           WHERE employee_id = $1 
           AND id NOT IN (
             SELECT id FROM destination_history 
             WHERE employee_id = $1 
             ORDER BY last_used_at DESC 
             LIMIT 5
           )`,
          [employeeId]
        );
      }
    }

    await client.query('COMMIT');
    
    res.json({ message: `${employeeIds.length}件の行き先を更新しました` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  } finally {
    client.release();
  }
});

// 行き先更新
app.put('/api/whereabouts/:employeeId', async (req, res) => {
  const { employeeId } = req.params;
  const { destination, return_time, remarks } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 行き先更新
    const result = await client.query(
      `UPDATE whereabouts 
       SET destination = $1, return_time = $2, remarks = $3, updated_at = NOW() 
       WHERE employee_id = $4 
       RETURNING *`,
      [destination || '', return_time || '', remarks || '', employeeId]
    );

    // 行き先が空でない場合、履歴に追加
    if (destination && destination.trim() !== '') {
      // 既存の同じ行き先を削除
      await client.query(
        'DELETE FROM destination_history WHERE employee_id = $1 AND destination = $2',
        [employeeId, destination]
      );

      // 新しい履歴を追加
      await client.query(
        'INSERT INTO destination_history (employee_id, destination, last_used_at) VALUES ($1, $2, NOW())',
        [employeeId, destination]
      );

      // 直近5件以外を削除
      await client.query(
        `DELETE FROM destination_history 
         WHERE employee_id = $1 
         AND id NOT IN (
           SELECT id FROM destination_history 
           WHERE employee_id = $1 
           ORDER BY last_used_at DESC 
           LIMIT 5
         )`,
        [employeeId]
      );
    }

    await client.query('COMMIT');
    
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  } finally {
    client.release();
  }
});

// ========================================
// 履歴関連API
// ========================================

// 社員の行き先履歴取得（直近5件）
app.get('/api/history/:employeeId', async (req, res) => {
  const { employeeId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, destination, last_used_at 
       FROM destination_history 
       WHERE employee_id = $1 
       ORDER BY last_used_at DESC 
       LIMIT 5`,
      [employeeId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// 個人履歴削除
app.delete('/api/history/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM destination_history WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '履歴が見つかりません' });
    }
    
    res.json({ success: true, message: '履歴を削除しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ========================================
// 全体設定関連API
// ========================================

// 全体設定取得
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT auto_refresh_minutes FROM app_settings WHERE id = 1'
    );
    
    if (result.rows.length === 0) {
      // 設定がない場合は初期値を返す
      res.json({ auto_refresh_minutes: 0 });
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// 全体設定更新
app.put('/api/settings', async (req, res) => {
  const { auto_refresh_minutes } = req.body;
  
  if (auto_refresh_minutes === undefined || auto_refresh_minutes < 0) {
    return res.status(400).json({ error: '自動更新時間は0以上で設定してください' });
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO app_settings (id, auto_refresh_minutes, updated_at) 
       VALUES (1, $1, NOW())
       ON CONFLICT (id) 
       DO UPDATE SET auto_refresh_minutes = $1, updated_at = NOW()
       RETURNING *`,
      [auto_refresh_minutes]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ========================================
// ログイン認証関連API
// ========================================

// ログイン認証
app.post('/api/auth/login', async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'ログインコードを入力してください' });
  }
  
  try {
    // 入力されたコードをハッシュ化
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    
    // データベースのハッシュと比較
    const result = await pool.query(
      'SELECT login_code_hash FROM login_settings WHERE id = 1'
    );
    
    if (result.rows.length === 0) {
      return res.status(500).json({ error: 'ログイン設定が見つかりません' });
    }
    
    const storedHash = result.rows[0].login_code_hash;
    
    if (hash === storedHash) {
      // 認証成功
      res.json({ success: true, message: 'ログインしました' });
    } else {
      // 認証失敗
      res.status(401).json({ success: false, error: 'ログインコードが正しくありません' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ログインコード変更
app.put('/api/auth/change-code', async (req, res) => {
  const { currentCode, newCode } = req.body;
  
  if (!currentCode || !newCode) {
    return res.status(400).json({ error: '現在のコードと新しいコードを入力してください' });
  }
  
  if (newCode.length < 1 || newCode.length > 12) {
    return res.status(400).json({ error: '新しいコードは1〜12文字で設定してください' });
  }
  
  try {
    // 現在のコードを確認
    const currentHash = crypto.createHash('sha256').update(currentCode).digest('hex');
    const result = await pool.query(
      'SELECT login_code_hash FROM login_settings WHERE id = 1'
    );
    
    if (result.rows.length === 0) {
      return res.status(500).json({ error: 'ログイン設定が見つかりません' });
    }
    
    const storedHash = result.rows[0].login_code_hash;
    
    if (currentHash !== storedHash) {
      return res.status(401).json({ error: '現在のコードが正しくありません' });
    }
    
    // 新しいコードをハッシュ化して保存
    const newHash = crypto.createHash('sha256').update(newCode).digest('hex');
    await pool.query(
      'UPDATE login_settings SET login_code_hash = $1, updated_at = NOW() WHERE id = 1',
      [newHash]
    );
    
    res.json({ success: true, message: 'ログインコードを変更しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ========================================
// 共通履歴関連API
// ========================================

// 共通履歴取得（直近20件）
app.get('/api/common-history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, destination, last_used_at 
       FROM common_destination_history 
       ORDER BY last_used_at DESC 
       LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// 共通履歴追加
app.post('/api/common-history', async (req, res) => {
  const { destination } = req.body;
  
  if (!destination || destination.trim() === '') {
    return res.status(400).json({ error: '行き先を入力してください' });
  }

  try {
    // 既に存在する場合は last_used_at を更新、なければ新規追加
    const result = await pool.query(
      `INSERT INTO common_destination_history (destination, last_used_at) 
       VALUES ($1, NOW()) 
       ON CONFLICT (destination) 
       DO UPDATE SET last_used_at = NOW()
       RETURNING *`,
      [destination.trim()]
    );

    // 20件を超えた場合、古いものを削除
    await pool.query(
      `DELETE FROM common_destination_history 
       WHERE id NOT IN (
         SELECT id FROM common_destination_history 
         ORDER BY last_used_at DESC 
         LIMIT 20
       )`
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// 共通履歴削除
app.delete('/api/common-history/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM common_destination_history WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '履歴が見つかりません' });
    }

    res.json({ message: '削除しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ========================================
// サーバー起動
// ========================================

app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});
