terraform {
  required_version = ">= 1.12.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

provider "aws" {
  region = "ap-northeast-1"
  # profile = "default"     # CLIプロファイルを使う場合は有効化
}

# リモートステート格納用のS3バケット
resource "aws_s3_bucket" "tfstate" {
  bucket        = "logicmap-tfstate-main" # 一意な名前に変更
  force_destroy = false
}

# バージョニング有効化（万一の復旧用）
resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

# デフォルトのSSEを有効化
resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
