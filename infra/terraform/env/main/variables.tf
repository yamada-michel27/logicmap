variable "waf_allowed_hostnames" {
  type        = list(string)
  description = "WAFで許可するHostヘッダ"
}

variable "frontend_hostnames" {
  type        = list(string)
  description = "フロントエンド向けホストヘッダ"
}

variable "backend_hostnames" {
  type        = list(string)
  description = "バックエンド向けホストヘッダ"
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM証明書ARN"
}

variable "frontend_domain_name" {
  type        = string
  description = "フロントエンド用Aレコード名"
}

variable "backend_domain_name" {
  type        = string
  description = "バックエンド用Aレコード名"
}

variable "route53_zone_id" {
  type        = string
  description = "Route53ホストゾーンID"
}

variable "waf_log_bucket_name" {
  type        = string
  description = "WAFログのS3バケット名"
}

variable "waf_firehose_name" {
  type        = string
  description = "WAFログ用Firehose名"
}
