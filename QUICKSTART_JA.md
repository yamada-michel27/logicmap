# LogicMap クイックスタートガイド

## 最速で始める 🚀

### 1. リポジトリをクローン

```bash
git clone https://github.com/yamada-michel27/logicmap.git
cd logicmap
```

### 2. 起動方法を選択

#### オプションA: Dockerを使用（推奨）

```bash
docker compose up --build
```

これだけです！以下のURLにアクセス:
- **アプリ**: http://localhost:3000
- **API**: http://localhost:8080

#### オプションB: ローカル開発

**必要なもの:**
- Node.js 20+
- Go 1.21+

**ターミナル1 - バックエンド起動:**
```bash
cd backend
go run main.go
```

**ターミナル2 - フロントエンド起動:**
```bash
cd frontend
npm install
npm run dev
```

アクセス: http://localhost:3000

## 使い方

1. **Markdownを入力**
   ```markdown
   # バブルソート
   1. 配列の準備
   2. 隣接要素を比較
   3. 必要に応じて交換
   4. すべてソートされるまで繰り返す
   5. 完了
   ```

2. **「Visualize Flow」ボタンをクリック**

3. **フローチャートが表示されます！**
   - ドラッグして移動
   - マウスホイールでズーム
   - ミニマップで全体表示

## プロジェクト構成

```
logicmap/
├── backend/     # Go API (ポート: 8080)
├── frontend/    # Next.js (ポート: 3000)
└── docker-compose.yml
```

## よくある質問

### ポートが既に使用されている場合は？

`docker-compose.yml`を編集:

```yaml
services:
  backend:
    ports:
      - "8081:8080"  # 別のポートに変更
  frontend:
    ports:
      - "3001:3000"  # 別のポートに変更
```

### エラーが出た場合は？

```bash
# ログを確認
docker compose logs

# コンテナを再起動
docker compose down
docker compose up --build
```

### 停止するには？

```bash
# Ctrl+C を押すか
docker compose down
```

## 次のステップ

- 📖 詳細は [README.md](README.md) を参照
- 🐳 Docker詳細は [DOCKER.md](DOCKER.md) を参照
- 🔧 技術詳細は [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) を参照

## トラブルシューティング

### Docker関連

**問題**: `docker compose: command not found`
```bash
# Docker Composeがインストールされているか確認
docker compose version

# 古いバージョンの場合
docker-compose up --build
```

**問題**: ビルドが遅い
```bash
# キャッシュを使用して再ビルド
docker compose build
docker compose up
```

### ローカル開発関連

**問題**: `go: command not found`
- Goをインストール: https://go.dev/dl/

**問題**: `npm: command not found`
- Node.jsをインストール: https://nodejs.org/

**問題**: フロントエンドがバックエンドに接続できない
- バックエンドが起動しているか確認
- `frontend/.env.local`の`NEXT_PUBLIC_API_URL`を確認

## 開発Tips

### ホットリロード

- **フロントエンド**: 自動でリロード
- **バックエンド**: 手動再起動が必要

### APIをテスト

```bash
# ヘルスチェック
curl http://localhost:8080/health

# 解析テスト
curl -X POST http://localhost:8080/parse \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Test"}'
```

### ログを見る

```bash
# Docker使用時
docker compose logs -f

# ローカル開発時
# ターミナルに直接表示されます
```

## サポート

問題が発生した場合:
1. このガイドのトラブルシューティングを確認
2. [README.md](README.md)の詳細ドキュメントを参照
3. GitHubでIssueを作成

## ライセンス

MIT
