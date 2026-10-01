# Amazon Aurora PostgreSQL Global Database Configuration
# Primary: ap-south-1 (Mumbai) | Secondary: ap-south-2 (Hyderabad)

resource "aws_rds_global_cluster" "paysecure_global_db" {
  global_cluster_identifier = "paysecure-global-db"
  engine                    = "aurora-postgresql"
  engine_version            = "15.4"
  database_name             = "paysecure_ledger"
  storage_encrypted         = true
  deletion_protection       = true
}

# Subnet Group - Mumbai
resource "aws_db_subnet_group" "mumbai_db_subnet" {
  name        = "paysecure-mumbai-db-subnet-group"
  description = "Aurora DB Subnet Group across 3 AZs in Mumbai"
  subnet_ids  = ["subnet-mum-data-1a", "subnet-mum-data-1b", "subnet-mum-data-1c"]
}

# Subnet Group - Hyderabad
resource "aws_db_subnet_group" "hyderabad_db_subnet" {
  provider    = aws.dr
  name        = "paysecure-hyderabad-db-subnet-group"
  description = "Aurora DB Subnet Group across 3 AZs in Hyderabad"
  subnet_ids  = ["subnet-hyd-data-2a", "subnet-hyd-data-2b", "subnet-hyd-data-2c"]
}

# Primary Cluster (Mumbai)
resource "aws_rds_cluster" "mumbai_primary" {
  cluster_identifier        = "paysecure-aurora-mumbai"
  engine                    = aws_rds_global_cluster.paysecure_global_db.engine
  engine_version            = aws_rds_global_cluster.paysecure_global_db.engine_version
  global_cluster_identifier = aws_rds_global_cluster.paysecure_global_db.id
  database_name             = "paysecure_ledger"
  master_username           = "paysecure_admin"
  master_password           = "ReplaceWithSecretsManagerRef123!"
  db_subnet_group_name      = aws_db_subnet_group.mumbai_db_subnet.name
  vpc_security_group_ids    = ["sg-mum-aurora"]
  kms_key_id                = aws_kms_key.primary_mrk.arn
  storage_encrypted         = true
  deletion_protection       = true
  backup_retention_period   = 35
  preferred_backup_window   = "19:00-20:00"
  copy_tags_to_snapshot     = true
  enabled_cloudwatch_logs_exports = ["postgresql"]

  serverlessv2_scaling_configuration {
    max_capacity = 128
    min_capacity = 16
  }

  lifecycle {
    ignore_changes = [master_password]
  }
}

# Primary Writer Instance
resource "aws_rds_cluster_instance" "mumbai_writer" {
  identifier           = "paysecure-aurora-mum-writer"
  cluster_identifier   = aws_rds_cluster.mumbai_primary.id
  instance_class       = var.aurora_instance_class
  engine               = aws_rds_cluster.mumbai_primary.engine
  engine_version       = aws_rds_cluster.mumbai_primary.engine_version
  db_subnet_group_name = aws_db_subnet_group.mumbai_db_subnet.name
  publicly_accessible  = false
  auto_minor_version_upgrade = false
  performance_insights_enabled = true
}

# Primary Read Replicas (2 Readers for Multi-AZ read resilience)
resource "aws_rds_cluster_instance" "mumbai_readers" {
  count                = 2
  identifier           = "paysecure-aurora-mum-reader-${count.index + 1}"
  cluster_identifier   = aws_rds_cluster.mumbai_primary.id
  instance_class       = var.aurora_instance_class
  engine               = aws_rds_cluster.mumbai_primary.engine
  engine_version       = aws_rds_cluster.mumbai_primary.engine_version
  db_subnet_group_name = aws_db_subnet_group.mumbai_db_subnet.name
  publicly_accessible  = false
  auto_minor_version_upgrade = false
  performance_insights_enabled = true
}

# Secondary Cluster (Hyderabad - DR)
resource "aws_rds_cluster" "hyderabad_secondary" {
  provider                  = aws.dr
  cluster_identifier        = "paysecure-aurora-hyderabad"
  engine                    = aws_rds_global_cluster.paysecure_global_db.engine
  engine_version            = aws_rds_global_cluster.paysecure_global_db.engine_version
  global_cluster_identifier = aws_rds_global_cluster.paysecure_global_db.id
  db_subnet_group_name      = aws_db_subnet_group.hyderabad_db_subnet.name
  vpc_security_group_ids    = ["sg-hyd-aurora"]
  kms_key_id                = aws_kms_replica_key.dr_mrk.arn
  storage_encrypted         = true
  deletion_protection       = true
  copy_tags_to_snapshot     = true
  enabled_cloudwatch_logs_exports = ["postgresql"]

  depends_on = [
    aws_rds_cluster_instance.mumbai_writer
  ]
}

# Secondary Read Replica Instances in Hyderabad
resource "aws_rds_cluster_instance" "hyderabad_replicas" {
  provider             = aws.dr
  count                = 2
  identifier           = "paysecure-aurora-hyd-replica-${count.index + 1}"
  cluster_identifier   = aws_rds_cluster.hyderabad_secondary.id
  instance_class       = var.aurora_instance_class
  engine               = aws_rds_cluster.hyderabad_secondary.engine
  engine_version       = aws_rds_cluster.hyderabad_secondary.engine_version
  db_subnet_group_name = aws_db_subnet_group.hyderabad_db_subnet.name
  publicly_accessible  = false
  auto_minor_version_upgrade = false
  performance_insights_enabled = true
}
