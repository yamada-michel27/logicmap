output "vpc_id" {
  value       = module.network.vpc_id
  description = "VPC ID"
}

output "public_subnet_ids" {
  value       = module.network.public_subnet_ids
  description = "パブリックサブネットID"
}

output "private_subnet_ids" {
  value       = module.network.private_subnet_ids
  description = "プライベートサブネットID"
}

output "alb_dns_name" {
  value       = aws_lb.api.dns_name
  description = "API ALBのDNS"
}

output "backend_repository_url" {
  value       = module.backend_repository.repository_url
  description = "バックエンドECR"
}

output "frontend_repository_url" {
  value       = module.frontend_repository.repository_url
  description = "フロントエンドECR"
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.this.name
  description = "ECSクラスター名"
}

output "rds_endpoint" {
  value       = aws_db_instance.db.address
  description = "RDS endpoint"
}
