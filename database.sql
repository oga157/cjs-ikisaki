-- 行き先掲示板 データベース初期化スクリプト

-- 既存テーブルの削除（再実行用）
DROP TABLE IF EXISTS destination_history CASCADE;
DROP TABLE IF EXISTS whereabouts CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- 社員マスタテーブル
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    department VARCHAR(100) NOT NULL,      -- 所属
    name VARCHAR(100) NOT NULL,            -- 名前
    display_order INTEGER NOT NULL,        -- 表示順序
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 行き先情報テーブル
CREATE TABLE whereabouts (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    destination VARCHAR(200),              -- 行き先（NULLまたは空白=在席）
    return_time VARCHAR(100),              -- 戻り
    remarks VARCHAR(200),                  -- 備考
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 行き先履歴テーブル
CREATE TABLE destination_history (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    destination VARCHAR(200) NOT NULL,
    last_used_at TIMESTAMP DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_employees_order ON employees(display_order);
CREATE INDEX idx_whereabouts_employee ON whereabouts(employee_id);
CREATE INDEX idx_history_employee ON destination_history(employee_id);
CREATE INDEX idx_history_last_used ON destination_history(employee_id, last_used_at DESC);

-- サンプルデータ（テスト用）
INSERT INTO employees (department, name, display_order) VALUES
('営業部', '田中 太郎', 1),
('営業部', '佐藤 花子', 2),
('開発部', '鈴木 一郎', 3),
('開発部', '高橋 美咲', 4),
('総務部', '伊藤 健太', 5);

-- 各社員の初期行き先情報を作成
INSERT INTO whereabouts (employee_id, destination, return_time, remarks)
SELECT id, '', '', '' FROM employees;

-- コメント追加
COMMENT ON TABLE employees IS '社員マスタ';
COMMENT ON TABLE whereabouts IS '現在の行き先情報';
COMMENT ON TABLE destination_history IS '行き先履歴（個人別、直近5件まで保持）';
