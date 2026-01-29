module "logicmap" {
  source = "../.."

  environment        = "main"
  aws_region         = "ap-northeast-1"
  availability_zones = ["ap-northeast-1a", "ap-northeast-1c"]

  backend_container_environment = {
    APP_ENV     = "main"
    DB_SSLMODE  = "require"
  }

  alb_ingress_cidrs      = ["0.0.0.0/0"]
  backend_desired_count  = 1
  waf_allowed_hostnames  = var.waf_allowed_hostnames
  frontend_hostnames     = var.frontend_hostnames
  backend_hostnames      = var.backend_hostnames
  acm_certificate_arn    = var.acm_certificate_arn
  frontend_domain_name   = var.frontend_domain_name
  backend_domain_name    = var.backend_domain_name
  route53_zone_id        = var.route53_zone_id
  waf_log_bucket_name    = var.waf_log_bucket_name
  waf_firehose_name      = var.waf_firehose_name

  additional_tags = {
    Owner = "logicmap"
  }
}
