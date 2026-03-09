variable "name" {
  type        = string
  description = "サービス識別名"
}

variable "cluster_arn" {
  type        = string
  description = "ECSクラスターARN"
}

variable "container_name" {
  type        = string
  description = "コンテナ名"
}

variable "container_image" {
  type        = string
  description = "コンテナイメージ"
}

variable "container_port" {
  type        = number
  description = "コンテナポート"
}

variable "desired_count" {
  type        = number
  default     = 1
}

variable "cpu" {
  type        = number
  description = "Fargate CPU"
}

variable "memory" {
  type        = number
  description = "Fargateメモリ"
}

variable "subnet_ids" {
  type        = list(string)
  description = "配置対象サブネット"
}

variable "security_group_ids" {
  type        = list(string)
}

variable "assign_public_ip" {
  type    = bool
  default = false
}

variable "target_group_arn" {
  type        = string
  default     = null
  description = "ALB Target Group"
}

variable "environment" {
  type        = map(string)
  default     = {}
}

variable "secrets" {
  type = list(object({
    name      = string
    valueFrom = string
  }))
  default = []
}

variable "secret_arns" {
  type        = list(string)
  default     = []
  description = "実行ロールに GetSecretValue を許可する Secrets Manager シークレットの ARN リスト"
}

variable "task_role_arn" {
  type    = string
  default = null
}

variable "aws_region" {
  type        = string
  description = "AWSリージョン"
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "enable_execute_command" {
  type    = bool
  default = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
