module "network" {
  source               = "./modules/network"
  name                 = "${local.name_prefix}-vpc"
  cidr                 = var.vpc_cidr
  azs                  = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  tags                 = local.tags
}

module "backend_repository" {
  source = "./modules/ecr_repository"

  name                 = "${local.name_prefix}-backend"
  scan_on_push         = true
  image_tag_mutability = "MUTABLE"
  tags                 = local.tags
}

module "frontend_repository" {
  source = "./modules/ecr_repository"

  name         = "${local.name_prefix}-frontend"
  scan_on_push = false
  tags         = local.tags
}

resource "aws_ecs_cluster" "this" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.tags
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb"
  description = "ALB ingress"
  vpc_id      = module.network.vpc_id

  dynamic "ingress" {
    for_each = var.alb_ingress_cidrs

    content {
      description = "HTTP ingress"
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  dynamic "ingress" {
    for_each = var.alb_ingress_cidrs

    content {
      description = "HTTPS ingress"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_security_group" "ecs_service" {
  name        = "${local.name_prefix}-ecs"
  description = "ECS service access"
  vpc_id      = module.network.vpc_id

  ingress {
    description     = "From ALB to backend"
    from_port       = var.backend_port
    to_port         = var.backend_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "From ALB to frontend"
    from_port       = var.frontend_port
    to_port         = var.frontend_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds"
  description = "RDS access"
  vpc_id      = module.network.vpc_id

  ingress {
    description     = "From ECS"
    from_port       = var.db_port
    to_port         = var.db_port
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_service.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_lb" "api" {
  name               = substr("${local.name_prefix}-api", 0, 32)
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.network.public_subnet_ids

  tags = local.tags
}

resource "aws_lb_target_group" "api" {
  name        = substr("${local.name_prefix}-tg", 0, 32)
  port        = var.backend_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = module.network.vpc_id

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    healthy_threshold   = 3
    unhealthy_threshold = 2
    interval            = 30
    timeout             = 5
  }

  tags = local.tags
}

resource "aws_lb_target_group" "frontend" {
  name        = substr("${local.name_prefix}-fe-tg", 0, 32)
  port        = var.frontend_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = module.network.vpc_id

  health_check {
    path                = "/"
    protocol            = "HTTP"
    matcher             = "200-399"
    healthy_threshold   = 3
    unhealthy_threshold = 2
    interval            = 30
    timeout             = 5
  }

  tags = local.tags
}

resource "aws_lb_listener" "api_http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "api_https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      status_code  = "404"
      message_body = "Not Found"
    }
  }
}

resource "aws_lb_listener_rule" "frontend" {
  listener_arn = aws_lb_listener.api_https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  condition {
    host_header {
      values = local.frontend_hostnames
    }
  }
}

resource "aws_lb_listener_rule" "backend" {
  listener_arn = aws_lb_listener.api_https.arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    host_header {
      values = local.backend_hostnames
    }
  }
}

resource "aws_route53_record" "frontend" {
  zone_id = var.route53_zone_id
  name    = var.frontend_domain_name
  type    = "A"

  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "backend" {
  zone_id = var.route53_zone_id
  name    = var.backend_domain_name
  type    = "A"

  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}

resource "aws_wafv2_web_acl" "alb" {
  name        = "${local.name_prefix}-alb"
  description = "Shared ALB WAF"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "allow-listed-hosts-only"
    priority = 0
    action {
      block {}
    }

    statement {
      not_statement {
        statement {
          or_statement {
            dynamic "statement" {
              for_each = local.waf_allowed_hostnames

              content {
                byte_match_statement {
                  search_string         = statement.value
                  positional_constraint = "EXACTLY"
                  field_to_match {
                    single_header {
                      name = "host"
                    }
                  }
                  text_transformation {
                    priority = 0
                    type     = "LOWERCASE"
                  }
                }
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-allow-listed-hosts-only"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "managed-known-bad-inputs"
    priority = 10
    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
        scope_down_statement {
          or_statement {
            dynamic "statement" {
              for_each = local.waf_allowed_hostnames

              content {
                byte_match_statement {
                  search_string         = statement.value
                  positional_constraint = "EXACTLY"
                  field_to_match {
                    single_header {
                      name = "host"
                    }
                  }
                  text_transformation {
                    priority = 0
                    type     = "LOWERCASE"
                  }
                }
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-managed-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "managed-common"
    priority = 20
    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
        scope_down_statement {
          or_statement {
            dynamic "statement" {
              for_each = local.waf_allowed_hostnames

              content {
                byte_match_statement {
                  search_string         = statement.value
                  positional_constraint = "EXACTLY"
                  field_to_match {
                    single_header {
                      name = "host"
                    }
                  }
                  text_transformation {
                    priority = 0
                    type     = "LOWERCASE"
                  }
                }
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-managed-common"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-alb-waf"
    sampled_requests_enabled   = true
  }

  tags = local.tags
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.api.arn
  web_acl_arn  = aws_wafv2_web_acl.alb.arn
}

resource "aws_s3_bucket" "waf_logs" {
  bucket = var.waf_log_bucket_name
  tags   = local.tags
}

resource "aws_s3_bucket_versioning" "waf_logs" {
  bucket = aws_s3_bucket.waf_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "waf_logs" {
  bucket = aws_s3_bucket.waf_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "waf_logs" {
  bucket                  = aws_s3_bucket.waf_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "waf_firehose_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["firehose.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "waf_firehose" {
  name               = "${local.name_prefix}-waf-firehose"
  assume_role_policy = data.aws_iam_policy_document.waf_firehose_assume.json
}

data "aws_iam_policy_document" "waf_firehose_s3" {
  statement {
    actions = [
      "s3:AbortMultipartUpload",
      "s3:GetBucketLocation",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
      "s3:PutObject",
    ]

    resources = [
      aws_s3_bucket.waf_logs.arn,
      "${aws_s3_bucket.waf_logs.arn}/*",
    ]
  }
}

resource "aws_iam_role_policy" "waf_firehose_s3" {
  name   = "${local.name_prefix}-waf-firehose-s3"
  role   = aws_iam_role.waf_firehose.id
  policy = data.aws_iam_policy_document.waf_firehose_s3.json
}

resource "aws_kinesis_firehose_delivery_stream" "waf_logs" {
  name        = var.waf_firehose_name
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn           = aws_iam_role.waf_firehose.arn
    bucket_arn         = aws_s3_bucket.waf_logs.arn
    buffering_interval = 300
    buffering_size     = 5
    compression_format = "GZIP"
  }
}

resource "aws_wafv2_web_acl_logging_configuration" "alb" {
  resource_arn            = aws_wafv2_web_acl.alb.arn
  log_destination_configs = [aws_kinesis_firehose_delivery_stream.waf_logs.arn]
}

resource "random_password" "db_master" {
  length           = 20
  special          = true
  override_special = "_@"
}

resource "aws_secretsmanager_secret" "db_master_password" {
  name = "${local.name_prefix}-db-master"
  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "db_master_password" {
  secret_id = aws_secretsmanager_secret.db_master_password.id
  secret_string = jsonencode({
    username = var.db_master_username
    password = random_password.db_master.result
  })
}

resource "aws_db_subnet_group" "db" {
  name       = "${local.name_prefix}-db-subnet"
  subnet_ids = module.network.private_subnet_ids
  tags       = local.tags
}

resource "aws_db_instance" "db" {
  identifier                 = "${local.name_prefix}-db"
  engine                     = var.db_engine
  instance_class             = var.db_instance_class
  allocated_storage          = var.db_allocated_storage
  storage_type               = "gp3"
  db_name                    = var.db_name
  username                   = var.db_master_username
  password                   = random_password.db_master.result
  port                       = var.db_port
  db_subnet_group_name       = aws_db_subnet_group.db.name
  vpc_security_group_ids     = [aws_security_group.rds.id]
  multi_az                   = var.db_multi_az
  backup_retention_period    = var.db_backup_retention_days
  backup_window              = var.db_preferred_backup_window
  deletion_protection        = var.db_deletion_protection
  storage_encrypted          = true
  publicly_accessible        = false
  copy_tags_to_snapshot      = true
  auto_minor_version_upgrade = true
  apply_immediately          = false
  skip_final_snapshot        = false
  maintenance_window         = var.db_preferred_maintenance_window

  tags = local.tags
}

locals {
  backend_image      = "${module.backend_repository.repository_url}:${var.backend_image_tag}"
  frontend_image     = "${module.frontend_repository.repository_url}:${var.frontend_image_tag}"
  frontend_hostnames = [for h in var.frontend_hostnames : lower(h)]
  backend_hostnames  = [for h in var.backend_hostnames : lower(h)]
  waf_allowed_hostnames = distinct(
    concat(
      [for h in var.waf_allowed_hostnames : lower(h)],
      local.frontend_hostnames,
      local.backend_hostnames,
    )
  )
}

module "backend_service" {
  source = "./modules/ecs_fargate_service"

  name               = "${local.name_prefix}-backend"
  cluster_arn        = aws_ecs_cluster.this.arn
  container_name     = "backend"
  container_image    = local.backend_image
  container_port     = var.backend_port
  desired_count      = var.backend_desired_count
  cpu                = var.backend_cpu
  memory             = var.backend_memory
  subnet_ids         = module.network.private_subnet_ids
  security_group_ids = [aws_security_group.ecs_service.id]
  assign_public_ip   = false
  target_group_arn   = aws_lb_target_group.api.arn
  log_retention_days = 30
  aws_region         = var.aws_region
  environment = merge(
    {
      "DB_HOST"       = aws_db_instance.db.address
      "DB_PORT"       = tostring(var.db_port)
      "DB_NAME"       = var.db_name
      "DB_USER"       = var.db_master_username
      "DB_SECRET_ARN" = aws_secretsmanager_secret.db_master_password.arn
    },
    var.backend_container_environment,
  )
  secrets = var.backend_container_secrets
  tags    = local.tags
}

module "frontend_service" {
  source = "./modules/ecs_fargate_service"

  name               = "${local.name_prefix}-frontend"
  cluster_arn        = aws_ecs_cluster.this.arn
  container_name     = "frontend"
  container_image    = local.frontend_image
  container_port     = var.frontend_port
  desired_count      = var.frontend_desired_count
  cpu                = var.frontend_cpu
  memory             = var.frontend_memory
  subnet_ids         = module.network.private_subnet_ids
  security_group_ids = [aws_security_group.ecs_service.id]
  assign_public_ip   = false
  target_group_arn   = aws_lb_target_group.frontend.arn
  log_retention_days = 30
  aws_region         = var.aws_region
  environment        = var.frontend_container_environment
  secrets            = var.frontend_container_secrets
  tags               = local.tags
}
