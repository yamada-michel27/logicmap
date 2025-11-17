# Docker Deployment Guide

このガイドでは、LogicMapをDockerとDocker Composeを使用してデプロイする方法を説明します。

## 前提条件 / Prerequisites

- Docker Desktop または Docker Engine (20.10+)
- Docker Compose V2 (2.0+)

Docker Composeのバージョンを確認:
```bash
docker compose version
```

## ローカル開発環境での起動 / Local Development

### 方法1: Docker Composeを使用（推奨）

```bash
# プロジェクトルートで実行
docker compose up --build

# バックグラウンドで実行
docker compose up -d --build

# ログを確認
docker compose logs -f

# 停止
docker compose down
```

### 方法2: 個別にDockerイメージをビルドして実行

#### Backend
```bash
cd backend
docker build -t logicmap-backend .
docker run -p 8080:8080 logicmap-backend
```

#### Frontend
```bash
cd frontend
docker build -t logicmap-frontend --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 .
docker run -p 3000:3000 logicmap-frontend
```

## アクセス / Access

起動後、以下のURLでアクセス可能です：

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **Health Check**: http://localhost:8080/health

## トラブルシューティング / Troubleshooting

### ポートが既に使用されている場合

別のポートを使用するには、`docker-compose.yml`を編集してください：

```yaml
services:
  backend:
    ports:
      - "8081:8080"  # 8081に変更
  
  frontend:
    ports:
      - "3001:3000"  # 3001に変更
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8081  # 対応するバックエンドポートに変更
```

### コンテナのログを確認

```bash
# 全てのログ
docker compose logs

# 特定のサービスのログ
docker compose logs backend
docker compose logs frontend

# リアルタイムでログを監視
docker compose logs -f
```

### コンテナの再ビルド

キャッシュを使わずに完全に再ビルドする場合：

```bash
docker compose build --no-cache
docker compose up
```

### クリーンアップ

全てのコンテナとイメージを削除：

```bash
# コンテナを停止して削除
docker compose down

# ボリュームも含めて削除
docker compose down -v

# イメージも削除
docker compose down --rmi all
```

## AWS デプロイメント / AWS Deployment

### Amazon ECS (Elastic Container Service)

1. **ECRにイメージをプッシュ**

```bash
# ECRにログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com

# リポジトリを作成
aws ecr create-repository --repository-name logicmap-backend
aws ecr create-repository --repository-name logicmap-frontend

# イメージをビルドしてタグ付け
docker build -t logicmap-backend:latest ./backend
docker tag logicmap-backend:latest <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/logicmap-backend:latest

docker build -t logicmap-frontend:latest ./frontend
docker tag logicmap-frontend:latest <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/logicmap-frontend:latest

# ECRにプッシュ
docker push <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/logicmap-backend:latest
docker push <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/logicmap-frontend:latest
```

2. **ECSタスク定義を作成**

タスク定義JSONファイルの例：

```json
{
  "family": "logicmap",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "<account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/logicmap-backend:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "PORT",
          "value": "8080"
        }
      ]
    },
    {
      "name": "frontend",
      "image": "<account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/logicmap-frontend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NEXT_PUBLIC_API_URL",
          "value": "http://internal-alb-url:8080"
        }
      ]
    }
  ]
}
```

### AWS App Runner (簡単なデプロイ)

AWS App Runnerを使用すると、より簡単にデプロイできます：

1. ECRにイメージをプッシュ（上記と同じ）
2. AWS Consoleで App Runner サービスを作成
3. ECRイメージを選択
4. 環境変数を設定

### AWS Amplify (Frontend のみ)

フロントエンドをAmplifyにデプロイ：

```bash
# Amplify CLIをインストール
npm install -g @aws-amplify/cli

# プロジェクトを初期化
cd frontend
amplify init

# ホスティングを追加
amplify add hosting

# デプロイ
amplify publish
```

## 本番環境の設定 / Production Configuration

### 環境変数

本番環境では、以下の環境変数を適切に設定してください：

**Backend:**
- `PORT`: APIサーバーのポート（デフォルト: 8080）

**Frontend:**
- `NEXT_PUBLIC_API_URL`: バックエンドAPIのURL
- `NODE_ENV`: production

### セキュリティ

本番環境では以下を検討してください：

1. **HTTPS の有効化**: ALB/CloudFrontでSSL証明書を設定
2. **CORS の制限**: バックエンドのCORS設定を本番ドメインに限定
3. **Rate Limiting**: API レートリミットの実装
4. **認証**: ユーザー認証の追加

## ヘルスチェック / Health Checks

バックエンドには `/health` エンドポイントがあります：

```bash
curl http://localhost:8080/health
# Response: {"status":"ok"}
```

このエンドポイントをロードバランサーやオーケストレーションシステムのヘルスチェックに使用できます。

## スケーリング / Scaling

### 水平スケーリング

ECS や Kubernetes を使用して、必要に応じてコンテナ数を増やすことができます。

### 垂直スケーリング

コンテナのCPUとメモリを増やす場合は、タスク定義またはdocker-compose.ymlを更新します。

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```
