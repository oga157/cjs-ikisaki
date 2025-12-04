# 行き先掲示板 Webアプリ

## 概要
社員の行き先を管理するWebアプリケーション。社外からもアクセス可能で、認証不要。

## 技術スタック
- **フロントエンド**: HTML + Vanilla JavaScript + CSS
- **バックエンド**: Node.js + Express
- **データベース**: Supabase (PostgreSQL)
- **ホスティング**: Render (無料プラン)

## データベース設計

### テーブル1: employees (社員マスタ)
```sql
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    department VARCHAR(100) NOT NULL,      -- 所属
    name VARCHAR(100) NOT NULL,            -- 名前
    display_order INTEGER NOT NULL,        -- 表示順序
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_employees_order ON employees(display_order);
```

### テーブル2: whereabouts (行き先情報)
```sql
CREATE TABLE whereabouts (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    destination VARCHAR(200),              -- 行き先（NULLまたは空白=在席）
    return_time VARCHAR(100),              -- 戻り
    remarks VARCHAR(200),                  -- 備考
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_whereabouts_employee ON whereabouts(employee_id);
```

### テーブル3: destination_history (行き先履歴)
```sql
CREATE TABLE destination_history (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    destination VARCHAR(200) NOT NULL,
    last_used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_history_employee ON destination_history(employee_id);
CREATE INDEX idx_history_last_used ON destination_history(employee_id, last_used_at DESC);
```

## ディレクトリ構成
```
whereabouts-board/
├── README.md
├── package.json
├── server.js                 # Express サーバー
├── database.sql              # データベース初期化SQL
├── public/
│   ├── index.html           # メイン画面（行き先一覧）
│   ├── admin.html           # 管理画面（社員登録・並び替え）
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── main.js          # メイン画面のロジック
│       └── admin.js         # 管理画面のロジック
└── .env                      # 環境変数（Supabase接続情報）
```

## API エンドポイント

### 社員関連
- `GET /api/employees` - 全社員取得（表示順）
- `POST /api/employees` - 社員追加
- `PUT /api/employees/:id` - 社員更新
- `DELETE /api/employees/:id` - 社員削除
- `PUT /api/employees/reorder` - 並び替え

### 行き先関連
- `GET /api/whereabouts` - 全行き先情報取得
- `PUT /api/whereabouts/:employeeId` - 行き先更新
- `PUT /api/whereabouts/bulk` - 複数社員の行き先一括更新

### 履歴関連
- `GET /api/history/:employeeId` - 社員の行き先履歴取得（直近5件）

## セットアップ手順

### 1. Supabaseプロジェクト作成
1. https://supabase.com/ でアカウント作成
2. 新規プロジェクトを作成
3. SQL Editorで`database.sql`を実行

### 2. ローカル開発
```bash
npm install
# .envファイルに接続情報を設定
npm start
```

### 3. Renderデプロイ
1. GitHubにプッシュ
2. Renderで新規Web Serviceを作成
3. 環境変数を設定
4. 自動デプロイ

## 環境変数
```
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
PORT=3000
```
