# Amazon ElastiCache Redis Global Datastore
# Primary Cluster in Mumbai, Read Replica Cluster in Hyderabad with <60s Promotion

# Subnet Group - Mumbai
resource "aws_elasticache_subnet_group" "mumbai_redis_subnet" {
  name       = "paysecure-mumbai-redis-subnet-group"
  subnet_ids = ["subnet-mum-app-1a", "subnet-mum-app-1b", "subnet-mum-app-1c"]
}

# Subnet Group - Hyderabad
resource "aws_elasticache_subnet_group" "hyderabad_redis_subnet" {
  provider   = aws.dr
  name       = "paysecure-hyderabad-redis-subnet-group"
  subnet_ids = ["subnet-hyd-app-2a", "subnet-hyd-app-2b", "subnet-hyd-app-2c"]
}

# Primary Replication Group (Mumbai)
resource "aws_elasticache_replication_group" "mumbai_primary_redis" {
  replication_group_id          = "paysecure-redis-mumbai"
  description                   = "PaySecure Redis Primary Cluster in Mumbai"
  node_type                     = var.redis_node_type
  port                          = 6379
  parameter_group_name          = "default.redis7.cluster.on"
  subnet_group_name             = aws_elasticache_subnet_group.mumbai_redis_subnet.name
  security_group_ids            = ["sg-mum-redis"]
  automatic_failover_enabled    = true
  multi_az_enabled              = true
  at_rest_encryption_enabled    = true
  transit_encryption_enabled    = true
  kms_key_id                    = aws_kms_key.primary_mrk.arn
  snapshot_retention_limit      = 7
  snapshot_window               = "20:00-21:00"

  num_node_groups         = 3
  replicas_per_node_group = 1
}

# Global Replication Group
resource "aws_elasticache_global_replication_group" "paysecure_redis_global" {
  global_replication_group_id_suffix = "paysecure-cache"
  primary_replication_group_id       = aws_elasticache_replication_group.mumbai_primary_redis.id
}

# Secondary Replication Group (Hyderabad)
resource "aws_elasticache_replication_group" "hyderabad_secondary_redis" {
  provider                      = aws.dr
  replication_group_id          = "paysecure-redis-hyderabad"
  description                   = "PaySecure Redis Global Datastore Replica Cluster in Hyderabad"
  global_replication_group_id   = aws_elasticache_global_replication_group.paysecure_redis_global.global_replication_group_id
  subnet_group_name             = aws_elasticache_subnet_group.hyderabad_redis_subnet.name
  security_group_ids            = ["sg-hyd-redis"]
  automatic_failover_enabled    = true
  multi_az_enabled              = true
  at_rest_encryption_enabled    = true
  transit_encryption_enabled    = true
  kms_key_id                    = aws_kms_replica_key.dr_mrk.arn

  depends_on = [
    aws_elasticache_global_replication_group.paysecure_redis_global
  ]
}
