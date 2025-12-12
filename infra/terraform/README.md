# Terraform スタック概要

このディレクトリは LogicMap のAWSインフラを IaC で管理するためのTerraform構成です。ECR/ECS(Fargate)、RDS(PostgreSQL)、ALB、VPCなどを1セットで作成します。

## ディレクトリ構成

```
infra/terraform/
├── main.tf              # ルートモジュール
├── variables.tf         # 変数定義
├── outputs.tf           # 出力
├── providers.tf         # プロバイダー設定
├── versions.tf          # terraform / provider バージョン
├── locals.tf            # 共通タグなど
├── env/
│   └── main/main.tf     # 単一環境向けエントリ
└── modules/             # 再利用モジュール群
    ├── network/         # VPC/NAT/サブネット
    ├── ecr_repository/  # ECR + ライフサイクル
    ├── ecs_fargate_service/
    └── aurora_serverless/ (未使用)
```

## 使い方

1. `infra/terraform/env/main` に移動し、`terraform init` を実行してバックエンドやプロバイダーを初期化します。
2. `terraform plan -var-file=...` ではなく、`env/main/main.tf` が`module "logicmap"`を呼び出しているため、そのまま `terraform plan` / `terraform apply` できます。必要に応じて `TF_VAR_***` で変数を上書きしてください。
3. S3リモートステートを利用する場合は `versions.tf` の `backend "s3" {}` にバケット情報を記述します。
4. デプロイ済みのECRへDockerイメージをPush後、ECSサービスは最新タスク定義に更新されます。CI/CDから `terraform apply` を呼び出すパイプラインを組む想定です。

## 補足

- バックエンドAPIはFargate上で稼働し、ALBを経由して公開されます。
- フロントエンドのホスティング先（S3/CloudFrontやAmplify等）は未定義なので、必要に応じて追加モジュールを作成してください。
