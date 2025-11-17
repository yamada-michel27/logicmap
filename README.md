# LogicMap

Markdownで記述したアルゴリズムを解析し、ReactFlowで処理・思考のフロウを可視化する学習プラットフォーム。理解度の可視化や変数状態表示をサポート。Go API＋Docker構成で、AWS上へのデプロイと将来拡張を前提に設計。

## 概要 / Overview

LogicMapは、Markdownで記述されたアルゴリズムをビジュアルフローチャートに変換するWebアプリケーションです。Next.js（TypeScript）とReactFlowを使用したフロントエンドと、Goで実装されたバックエンドAPIで構成されています。

LogicMap is a web application that transforms algorithms written in Markdown into visual flowcharts. It consists of a frontend built with Next.js (TypeScript) and ReactFlow, and a backend API implemented in Go.

## 技術スタック / Tech Stack

- **Frontend**: Next.js 15 (TypeScript), ReactFlow, Tailwind CSS
- **Backend**: Go 1.21+
- **Container**: Docker, Docker Compose
- **Deployment**: AWS対応のディレクトリ構成

## ディレクトリ構成 / Directory Structure

```
logicmap/
├── backend/              # Go API server
│   ├── main.go          # メインAPIコード / Main API code
│   ├── go.mod           # Go module definition
│   ├── Dockerfile       # Backend container
│   └── .dockerignore
├── frontend/            # Next.js application
│   ├── app/            # Next.js App Router
│   ├── components/     # Reactコンポーネント / React components
│   ├── public/         # 静的ファイル / Static files
│   ├── Dockerfile      # Frontend container
│   ├── .dockerignore
│   └── package.json
├── docker-compose.yml   # コンテナオーケストレーション / Container orchestration
└── README.md
```

## 機能 / Features

### 現在の実装
- ✅ Markdown入力インターフェース
- ✅ ReactFlowによる視覚化
- ✅ Go APIでのMarkdown解析（モックレスポンス）
- ✅ Docker/Docker Compose対応
- ✅ AWS対応ディレクトリ構造

### 将来の拡張計画
- [ ] 実際のMarkdown解析ロジック
- [ ] 変数状態の可視化
- [ ] 理解度トラッキング
- [ ] ユーザー認証

## セットアップ / Setup

### 前提条件 / Prerequisites

- Docker Desktop または Docker Engine + Docker Compose
- (ローカル開発の場合) Node.js 20+, Go 1.21+

### Dockerを使用した起動 / Running with Docker

```bash
# リポジトリをクローン / Clone the repository
git clone https://github.com/yamada-michel27/logicmap.git
cd logicmap

# Docker Composeで起動 / Start with Docker Compose
docker-compose up --build

# バックグラウンドで起動する場合 / To run in background
docker-compose up -d --build
```

アプリケーションは以下のURLでアクセス可能です:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080

### ローカル開発 / Local Development

#### Backend (Go API)

```bash
cd backend
go run main.go
```

#### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

## API仕様 / API Specification

### POST /parse

Markdownテキストを受け取り、ReactFlow用のノードとエッジを返します。

**Request:**
```json
{
  "markdown": "# Algorithm\n1. Start\n2. Process\n3. End"
}
```

**Response:**
```json
{
  "nodes": [
    {
      "id": "1",
      "type": "input",
      "data": { "label": "Start" },
      "position": { "x": 250, "y": 0 }
    }
  ],
  "edges": [
    {
      "id": "e1-2",
      "source": "1",
      "target": "2"
    }
  ]
}
```

### GET /health

ヘルスチェックエンドポイント

**Response:**
```json
{
  "status": "ok"
}
```

## AWS デプロイ / AWS Deployment

このプロジェクトはAWSへのデプロイを想定した構成になっています:

- **Frontend**: AWS Amplify, S3 + CloudFront, または ECS
- **Backend**: ECS (Elastic Container Service), Lambda, または App Runner
- **Networking**: VPC, ALB (Application Load Balancer)

### デプロイ例 / Deployment Example

```bash
# ECRにイメージをプッシュ / Push images to ECR
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com

docker tag logicmap-backend:latest <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/logicmap-backend:latest
docker push <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/logicmap-backend:latest

docker tag logicmap-frontend:latest <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/logicmap-frontend:latest
docker push <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/logicmap-frontend:latest
```

## 開発 / Development

### フロントエンドの開発

```bash
cd frontend
npm run dev     # 開発サーバー起動
npm run build   # プロダクションビルド
npm run lint    # リント実行
```

### バックエンドの開発

```bash
cd backend
go run main.go        # 開発サーバー起動
go build -o api       # ビルド
go test ./...         # テスト実行
```

## ライセンス / License

MIT

## 貢献 / Contributing

プルリクエストを歓迎します！大きな変更の場合は、まずissueを開いて変更内容を議論してください。

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
