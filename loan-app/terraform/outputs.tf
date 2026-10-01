output "route53_arc_cluster_endpoints" {
  description = "Regional endpoint URLs for Route 53 ARC cluster"
  value       = aws_route53recoverycontrolconfig_cluster.paysecure_arc_cluster.cluster_endpoints
}

output "mumbai_routing_control_arn" {
  description = "Routing control ARN for Mumbai (ap-south-1)"
  value       = aws_route53recoverycontrolconfig_routing_control.mumbai_control.arn
}

output "hyderabad_routing_control_arn" {
  description = "Routing control ARN for Hyderabad (ap-south-2)"
  value       = aws_route53recoverycontrolconfig_routing_control.hyderabad_control.arn
}

output "aurora_global_cluster_id" {
  description = "Amazon Aurora Global Database Cluster Identifier"
  value       = aws_rds_global_cluster.paysecure_global_db.id
}

output "aurora_primary_writer_endpoint" {
  description = "Mumbai Aurora Primary Cluster Writer Endpoint"
  value       = aws_rds_cluster.mumbai_primary.endpoint
}

output "aurora_secondary_reader_endpoint" {
  description = "Hyderabad Aurora DR Cluster Reader Endpoint"
  value       = aws_rds_cluster.hyderabad_secondary.reader_endpoint
}

output "dynamodb_global_table_arn" {
  description = "DynamoDB Global Table ARN for Idempotency Store"
  value       = aws_dynamodb_table.idempotency_table.arn
}

output "elasticache_global_replication_group_id" {
  description = "ElastiCache Redis Global Replication Group Identifier"
  value       = aws_elasticache_global_replication_group.paysecure_redis_global.global_replication_group_id
}

output "kms_mumbai_key_arn" {
  description = "Primary KMS Multi-Region Key ARN in ap-south-1"
  value       = aws_kms_key.primary_mrk.arn
}

output "kms_hyderabad_replica_key_arn" {
  description = "Replica KMS Multi-Region Key ARN in ap-south-2"
  value       = aws_kms_replica_key.dr_mrk.arn
}
