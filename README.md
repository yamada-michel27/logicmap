# LogicMap

LogicMap is a product that helps teams see and align complex reasoning by turning ideas and algorithmic steps into a visual flow.

## 背景 / Background

昨今のAI活用の加速により、全体像を掴めないまま作業が進んでしまう場面が増えています。LogicMapは、思考や手順の流れを可視化し、理解のスピードを上げ、認識のギャップを減らすために生まれたプロダクトです。

As AI usage accelerates, teams often move forward without a shared understanding of the full picture. LogicMap visualizes reasoning and process flows to speed up comprehension and reduce gaps in understanding.

## 概要 / Overview

LogicMapは、思考やアルゴリズムの流れをノードとエッジで可視化するWebアプリケーションです。フロントエンドはNext.jsとReactFlow、バックエンドはGoで構成されています。

LogicMap is a web application that visualizes reasoning and algorithm flows using nodes and edges. The frontend is built with Next.js and ReactFlow, and the backend is implemented in Go.

## 主な機能 / Key Features

- 思考や手順をフローチャートとして可視化 / Visualize reasoning and steps as flowcharts
- ノード・エッジ操作で構造を整理 / Structure ideas via node and edge operations
- フロントエンドとAPIの分離設計 / Clear separation of frontend and API layers

## 技術スタック / Tech Stack

- Frontend: Next.js (TypeScript), ReactFlow, Tailwind CSS
- Backend: Go
- Container: Docker, Docker Compose
- Infrastructure: AWS, Terraform

## アーキテクチャ / Architecture

- フロントエンドはNext.jsで提供
- バックエンドはGo APIとして提供
- Dockerでローカル開発可能
- AWS上で本番稼働中

## 必要ファイル / Required Files

`docker-compose.yml` は以下の環境変数を参照します。リポジトリ直下に `.env.local` を作成して設定してください。

`docker-compose.yml` references the following environment variables. Create a `.env.local` file at the repository root.

```env
BACKEND_PORT=8080
FRONTEND_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:8080
API_BASE_URL=http://backend:8080
NODE_ENV=development
DB_HOST=postgres
DB_PORT=5432
DB_NAME=logicmap
DB_USER=logicmap
DB_PASSWORD=logicmap
DB_SSLMODE=disable
CORS_ALLOW_ORIGINS=http://localhost:3000
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8080

## API仕様 / API Specification

保存機能向けのAPI（マルチユーザー前提）は以下を提供します。

The backend API for saving flows (multi-user) provides the following endpoints.

- `GET /health`
- `GET /flows` (Header: `X-User-Id`)
- `POST /flows` (Header: `X-User-Id`)
- `GET /flows/{id}` (Header: `X-User-Id`)
- `DELETE /flows/{id}` (Header: `X-User-Id`)

## AWSデプロイ / AWS Deployment

本番環境はAWS上で稼働しています。インフラはTerraformで管理されています。

Production runs on AWS. Infrastructure is managed with Terraform.

### Terraformで管理している主なリソース / Terraform-managed Resources

- VPC, パブリック/プライベートサブネット / VPC, public/private subnets
- ALB (HTTP/HTTPS) / ALB (HTTP/HTTPS)
- ECS (Fargate) クラスターとサービス / ECS (Fargate) cluster and services
- ECR (backend/frontend) / ECR (backend/frontend)
- RDS (エンジンはTerraform変数で指定) / RDS (engine is defined by Terraform variables)
- Route53 レコード / Route53 records
- WAF (ALB保護) / WAF (ALB protection)
- WAFログ用 S3 + Kinesis Firehose / S3 + Kinesis Firehose for WAF logs
- Secrets Manager / Secrets Manager

Terraform定義は `infra/terraform` にあります。

Terraform definitions are under `infra/terraform`.

## GitHub Actions / CI & Deployment

GitHub Actionsで手動デプロイを実行できます。

Manual deployments are available via GitHub Actions.

- `deploy-backend.yml`: ECRにイメージをpushし、ECSタスク定義を更新してデプロイ
- `deploy-frontend.yml`: ECRにイメージをpushし、ECSタスク定義を更新してデプロイ（`backend_url` を引数で指定）

## ライセンス / License

All Rights Reserved.

公式に提供されるサービス（https://app.m27.jp/）の利用は許可します。  
Use of the official service (https://app.m27.jp/) is permitted.

無断のローカル実行・複製・改変・配布・公開・販売・自前でのサービス提供は禁止です。  
Unauthorized local execution, copying, modification, distribution, publication, sale, or self-hosted service offering is prohibited.
