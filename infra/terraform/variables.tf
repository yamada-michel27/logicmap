variable "aws_region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "project" {
  description = "共通プロジェクト名"
  type        = string
  default     = "logicmap"
}

variable "environment" {
  description = "デプロイ環境を識別するラベル (例: stg, prod)"
  type        = string
  default     = "main"
}

variable "availability_zones" {
  description = "利用するAZ一覧"
  type        = list(string)
  default     = ["ap-northeast-1a", "ap-northeast-1c"]
}

variable "vpc_cidr" {
  description = "VPC CIDR"
  type        = string
  default     = "10.10.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "パブリックサブネットCIDR"
  type        = list(string)
  default     = ["10.10.0.0/24", "10.10.1.0/24"]
}

variable "private_subnet_cidrs" {
  description = "プライベートサブネットCIDR"
  type        = list(string)
  default     = ["10.10.10.0/24", "10.10.11.0/24"]
}

variable "additional_tags" {
  description = "任意の追加タグ"
  type        = map(string)
  default     = {}
}

variable "alb_ingress_cidrs" {
  description = "ALBへ直接アクセスを許可するCIDR"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "acm_certificate_arn" {
  description = "ALBで利用するACM証明書ARN（HTTPSリスナー用）"
  type        = string
}

variable "frontend_hostnames" {
  description = "フロントエンド向けホスト名（ALBリスナールール条件）"
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.frontend_hostnames) > 0
    error_message = "frontend_hostnames は少なくとも1つ以上のホスト名を指定してください。"
  }
}

variable "backend_hostnames" {
  description = "バックエンド向けホスト名（ALBリスナールール条件）"
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.backend_hostnames) > 0
    error_message = "backend_hostnames は少なくとも1つ以上のホスト名を指定してください。"
  }
}

variable "waf_allowed_hostnames" {
  description = "WAFで許可するHostヘッダ（ドメイン）の一覧"
  type        = list(string)

  validation {
    condition     = length(var.waf_allowed_hostnames) > 0
    error_message = "waf_allowed_hostnames は少なくとも1つ以上のホスト名を指定してください。"
  }
}

variable "backend_image_tag" {
  description = "バックエンドイメージタグ"
  type        = string
  default     = "latest"
}

variable "frontend_domain_name" {
  description = "フロントエンド用のFQDN (Route53 Aレコード)"
  type        = string
}

variable "backend_domain_name" {
  description = "バックエンド用のFQDN (Route53 Aレコード)"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 ホストゾーンID (ALB向けAレコード作成用)"
  type        = string
}

variable "backend_desired_count" {
  description = "バックエンドFargateのdesired count"
  type        = number
  default     = 1
}

variable "backend_cpu" {
  description = "バックエンドFargateのCPU (単位: vCPU * 1024)"
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "バックエンドFargateのメモリ(MB)"
  type        = number
  default     = 1024
}

variable "backend_port" {
  description = "バックエンドコンテナがリッスンするポート"
  type        = number
  default     = 8080
}

variable "frontend_image_tag" {
  description = "フロントエンドイメージタグ"
  type        = string
  default     = "latest"
}

variable "frontend_desired_count" {
  description = "フロントエンドFargateのdesired count"
  type        = number
  default     = 1
}

variable "frontend_cpu" {
  description = "フロントエンドFargateのCPU (単位: vCPU * 1024)"
  type        = number
  default     = 512
}

variable "frontend_memory" {
  description = "フロントエンドFargateのメモリ(MB)"
  type        = number
  default     = 1024
}

variable "frontend_port" {
  description = "フロントエンドコンテナがリッスンするポート"
  type        = number
  default     = 3000
}

variable "frontend_container_environment" {
  description = "フロントエンドコンテナに渡す環境変数"
  type        = map(string)
  default     = {}
}

variable "frontend_container_secrets" {
  description = "フロントエンドコンテナに渡すシークレット (Secrets ManagerやSSMのARN)"
  type = list(object({
    name      = string
    valueFrom = string
  }))
  default = []
}

variable "waf_log_bucket_name" {
  description = "WAFログを保存するS3バケット名（Firehoseの出力先）"
  type        = string
}

variable "waf_firehose_name" {
  description = "WAFログ用Kinesis Firehoseの名前"
  type        = string
}

variable "backend_container_environment" {
  description = "バックエンドコンテナに渡す環境変数"
  type        = map(string)
  default     = {}
}

variable "backend_container_secrets" {
  description = "バックエンドコンテナに渡すシークレット (Secrets ManagerやSSMのARN)"
  type = list(object({
    name      = string
    valueFrom = string
  }))
  default = []
}

variable "db_name" {
  description = "RDSのDB名"
  type        = string
  default     = "logicmap"
}

variable "db_master_username" {
  description = "DBマスターのユーザー名"
  type        = string
  default     = "logicmap"
}

variable "db_backup_retention_days" {
  description = "バックアップ保持期間"
  type        = number
  default     = 7
}

variable "db_preferred_backup_window" {
  description = "バックアップウィンドウ"
  type        = string
  default     = "02:00-03:00"
}

variable "db_preferred_maintenance_window" {
  description = "メンテナンスウィンドウ"
  type        = string
  default     = "sun:03:00-sun:04:00"
}

variable "db_engine" {
  description = "RDSエンジン"
  type        = string
  default     = "postgres"
}

variable "db_engine_version" {
  description = "RDSエンジンバージョン"
  type        = string
  default     = "15.3"
}

variable "db_instance_class" {
  description = "RDSインスタンスタイプ"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDSストレージ(GB)"
  type        = number
  default     = 20
}

variable "db_multi_az" {
  description = "Multi-AZを有効化するか"
  type        = bool
  default     = false
}

variable "db_deletion_protection" {
  description = "削除保護を有効化するか"
  type        = bool
  default     = true
}

variable "db_port" {
  description = "DB接続ポート"
  type        = number
  default     = 5432
}
