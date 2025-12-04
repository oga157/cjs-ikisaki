# 行き先掲示板 - セットアップ＆デプロイ手順

## 📋 目次
1. [Supabaseのセットアップ](#1-supabaseのセットアップ)
2. [ローカル開発環境のセットアップ](#2-ローカル開発環境のセットアップ)
3. [GitHubへのプッシュ](#3-githubへのプッシュ)
4. [Renderへのデプロイ](#4-renderへのデプロイ)
5. [動作確認](#5-動作確認)

---

## 1. Supabaseのセットアップ

### 1-1. アカウント作成
1. https://supabase.com/ にアクセス
2. 「Start your project」をクリック
3. GitHubアカウントでサインアップ（または新規作成）

### 1-2. プロジェクト作成
1. 「New Project」をクリック
2. 以下の情報を入力：
   - **Project name**: `whereabouts-board`（任意の名前）
   - **Database Password**: 強力なパスワードを生成（必ずメモする）
   - **Region**: `Northeast Asia (Tokyo)` を選択（日本に近いリージョン）
   - **Pricing Plan**: `Free` を選択
3. 「Create new project」をクリック
4. プロジェクトの作成完了を待つ（1〜2分）

### 1-3. データベース接続文字列の取得
1. 左サイドバーから「Project Settings」（歯車アイコン）をクリック
2. 「Database」タブをクリック
3. 「Connection string」セクションの「URI」をコピー
   - 例: `postgresql://postgres.xxxxx:password@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`
4. `[YOUR-PASSWORD]` の部分を実際のパスワードに置き換える

### 1-4. データベース初期化
1. 左サイドバーから「SQL Editor」をクリック
2. 「New query」をクリック
3. `database.sql` の内容をすべてコピーして貼り付け
4. 「Run」をクリック
5. 成功メッセージが表示されることを確認

### 1-5. 動作確認
1. 左サイドバーから「Table Editor」をクリック
2. `employees` テーブルを選択
3. サンプルデータ（5名）が登録されていることを確認

---

## 2. ローカル開発環境のセットアップ

### 2-1. 前提条件
- Node.js 18.x 以上がインストールされていること
- Git がインストールされていること

### 2-2. プロジェクトのセットアップ
```bash
# プロジェクトディレクトリに移動
cd whereabouts-board

# 依存パッケージをインストール
npm install
```

### 2-3. 環境変数の設定
```bash
# .env.example をコピーして .env を作成
cp .env.example .env

# .env ファイルを編集
# DATABASE_URL に Supabase の接続文字列を設定
```

**.env ファイルの例:**
```
DATABASE_URL=postgresql://postgres.xxxxx:your-password@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
PORT=3000
NODE_ENV=development
```

### 2-4. ローカルサーバー起動
```bash
# サーバーを起動
npm start

# または開発モード（ファイル変更時に自動再起動）
npm run dev
```

### 2-5. 動作確認
1. ブラウザで http://localhost:3000 にアクセス
2. 行き先掲示板が表示されることを確認
3. http://localhost:3000/admin.html で管理画面にアクセス

---

## 3. GitHubへのプッシュ

### 3-1. GitHubリポジトリ作成
1. https://github.com/ にログイン
2. 右上の「+」→「New repository」をクリック
3. 以下の情報を入力：
   - **Repository name**: `whereabouts-board`
   - **Description**: 「社員行き先掲示板」
   - **Public** / **Private**: お好みで選択
   - 「Add a README file」は**チェックしない**
4. 「Create repository」をクリック

### 3-2. ローカルからプッシュ
```bash
# Gitリポジトリを初期化（まだの場合）
git init

# すべてのファイルをステージング
git add .

# コミット
git commit -m "Initial commit"

# GitHubリポジトリをリモートに追加
git remote add origin https://github.com/YOUR-USERNAME/whereabouts-board.git

# メインブランチにプッシュ
git branch -M main
git push -u origin main
```

---

## 4. Renderへのデプロイ

### 4-1. Renderアカウント作成
1. https://render.com/ にアクセス
2. 「Get Started」をクリック
3. GitHubアカウントでサインアップ

### 4-2. Web Serviceの作成
1. ダッシュボードで「New +」→「Web Service」をクリック
2. 「Build and deploy from a Git repository」を選択し「Next」
3. GitHubリポジトリを接続：
   - 「Connect GitHub」をクリック
   - Renderに権限を付与
   - `whereabouts-board` リポジトリを選択し「Connect」

### 4-3. サービス設定
以下の情報を入力：

| 項目 | 値 |
|------|------|
| **Name** | `whereabouts-board`（任意の名前） |
| **Region** | `Singapore (Southeast Asia)` を推奨 |
| **Branch** | `main` |
| **Root Directory** | 空白のまま |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

### 4-4. 環境変数の設定
1. 「Advanced」セクションを展開
2. 「Add Environment Variable」をクリック
3. 以下の環境変数を追加：

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Supabaseの接続文字列（パスワード含む） |
| `NODE_ENV` | `production` |

4. 「Create Web Service」をクリック

### 4-5. デプロイ待機
- デプロイが開始されます（初回は5〜10分程度）
- ログが表示されるので、エラーがないか確認
- 「Live」と表示されたらデプロイ完了

### 4-6. URLの確認
- 画面上部に表示されるURL（例: `https://whereabouts-board.onrender.com`）をメモ
- このURLが公開URLになります

---

## 5. 動作確認

### 5-1. アプリケーションの動作確認
1. RenderのURLにアクセス
2. 行き先掲示板が表示されることを確認
3. サンプルデータが表示されているか確認

### 5-2. 機能テスト

#### メイン画面のテスト
1. 社員を選択してチェックボックスをON
2. 「行き先」に「外出」、「戻り」に「15:00」と入力
3. 「一括更新」をクリック
4. 行き先が更新されることを確認
5. 「編集」ボタンから個別編集も試す

#### 管理画面のテスト
1. 右上の「⚙️ 管理画面」をクリック
2. 新しい社員を追加
3. 社員情報を編集
4. ドラッグ&ドロップで並び替え
5. 社員を削除

### 5-3. スリープ動作の確認
1. 15分間アクセスせずに放置
2. 再度アクセスすると30秒〜1分の待ち時間が発生することを確認
3. 起動後は通常通り動作することを確認

---

## 6. トラブルシューティング

### データベース接続エラー
```
Error: connect ECONNREFUSED
```
**対処法:**
- `.env` または Render の環境変数で `DATABASE_URL` が正しく設定されているか確認
- Supabaseのパスワードが正しいか確認
- Supabaseのプロジェクトが起動しているか確認

### Renderでのビルドエラー
```
npm ERR! code ELIFECYCLE
```
**対処法:**
- `package.json` の依存関係が正しいか確認
- Node.js のバージョンを確認（18.x以上が必要）
- Render のログを確認し、具体的なエラーメッセージを特定

### 画面が真っ白
**対処法:**
- ブラウザの開発者ツール（F12）でコンソールエラーを確認
- API_BASE の設定が正しいか確認（`main.js`, `admin.js`）
- サーバーが正常に起動しているか Render のログで確認

---

## 7. メンテナンス

### コードの更新とデプロイ
```bash
# コードを修正後
git add .
git commit -m "機能追加: xxxxx"
git push origin main

# Renderが自動的に再デプロイを開始
```

### データベースのバックアップ
1. Supabaseの「Database」→「Backups」でバックアップを確認
2. 無料プランでは自動バックアップは7日間保持

### ログの確認
- Renderのダッシュボードで「Logs」タブからログを確認可能
- エラーやアクセス履歴を確認できる

---

## 8. 費用について

### 完全無料で運用可能
- **Supabase**: 無料プラン（500MB、無制限期間）
- **Render**: 無料プラン（750時間/月、スリープあり）
- **GitHub**: 無料プラン（パブリック/プライベートリポジトリ）

### 注意点
- Renderは15分間アクセスがないとスリープ状態になります
- 初回アクセス時に30秒〜1分の待ち時間が発生します
- 頻繁に使用する場合は有料プラン（$7/月〜）の検討も可能

---

## 9. 今後の機能拡張アイデア

- ✅ CSV エクスポート機能
- ✅ 検索・フィルター機能
- ✅ 日付別の履歴表示
- ✅ メール通知機能
- ✅ 休暇・出張などのステータス追加
- ✅ QRコード読み取りでの行き先登録
- ✅ PWA化（オフライン対応）

---

お疲れ様でした！これで行き先掲示板の構築とデプロイが完了です。
何か問題があれば、このドキュメントを参考にトラブルシューティングを行ってください。
