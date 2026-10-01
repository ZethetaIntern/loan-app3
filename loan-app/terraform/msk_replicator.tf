# Amazon MSK Multi-Region & AWS MSK Replicator
# Primary MSK Cluster (Mumbai) and DR Cluster (Hyderabad) with Cross-Region Topic & Offset Mirroring

# Mumbai Primary MSK Cluster
resource "aws_msk_cluster" "mumbai_msk" {
  cluster_name           = "paysecure-msk-mumbai"
  kafka_version          = "3.6.0"
  number_of_broker_nodes = 6

  broker_node_group_info {
    instance_type   = var.msk_broker_instance_type
    client_subnets  = ["subnet-mum-app-1a", "subnet-mum-app-1b", "subnet-mum-app-1c"]
    security_groups = ["sg-mum-msk"]
    storage_info {
      ebs_storage_info {
        volume_size = 2000
      }
    }
  }

  encryption_info {
    encryption_at_rest_kms_key_arn = aws_kms_key.primary_mrk.arn
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }
}

# Hyderabad DR MSK Cluster
resource "aws_msk_cluster" "hyderabad_msk" {
  provider               = aws.dr
  cluster_name           = "paysecure-msk-hyderabad"
  kafka_version          = "3.6.0"
  number_of_broker_nodes = 6

  broker_node_group_info {
    instance_type   = var.msk_broker_instance_type
    client_subnets  = ["subnet-hyd-app-2a", "subnet-hyd-app-2b", "subnet-hyd-app-2c"]
    security_groups = ["sg-hyd-msk"]
    storage_info {
      ebs_storage_info {
        volume_size = 2000
      }
    }
  }

  encryption_info {
    encryption_at_rest_kms_key_arn = aws_kms_replica_key.dr_mrk.arn
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }
}

# IAM Role for MSK Replicator
resource "aws_iam_role" "msk_replicator_role" {
  name = "paysecure-msk-replicator-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "kafka.amazonaws.com" }
    }]
  })
}

# AWS MSK Replicator (Managed active topic and consumer offset replication)
resource "aws_msk_replicator" "mumbai_to_hyd_replicator" {
  replicator_name             = "paysecure-mumbai-to-hyd-mirror"
  description                 = "Asynchronous Kafka topic & offset mirroring from Mumbai to Hyderabad"
  service_execution_role_arn  = aws_iam_role.msk_replicator_role.arn

  kafka_cluster {
    amazon_msk_cluster {
      msk_cluster_arn = aws_msk_cluster.mumbai_msk.arn
    }
    vpc_config {
      subnet_ids         = ["subnet-mum-app-1a", "subnet-mum-app-1b", "subnet-mum-app-1c"]
      security_groups_ids = ["sg-mum-msk"]
    }
  }

  kafka_cluster {
    amazon_msk_cluster {
      msk_cluster_arn = aws_msk_cluster.hyderabad_msk.arn
    }
    vpc_config {
      subnet_ids         = ["subnet-hyd-app-2a", "subnet-hyd-app-2b", "subnet-hyd-app-2c"]
      security_groups_ids = ["sg-hyd-msk"]
    }
  }

  replication_info_list {
    source_kafka_cluster_arn = aws_msk_cluster.mumbai_msk.arn
    target_kafka_cluster_arn = aws_msk_cluster.hyderabad_msk.arn
    target_compression_type  = "GZIP"

    topic_replication {
      topics_to_replicate = [
        "payment.events.*",
        "webhook.dispatch.*",
        "settlement.records.*",
        "audit.ledger.*"
      ]
      detect_and_copy_new_topics = true
      copy_topic_configurations  = true
    }

    consumer_group_replication {
      consumer_groups_to_replicate = [
        "paysecure-payment-orchestrators",
        "paysecure-webhook-workers",
        "paysecure-settlement-workers"
      ]
      detect_and_copy_new_consumer_groups = true
      synchronise_consumer_group_offsets  = true
    }
  }
}
