# Amazon DynamoDB Global Tables (Version 2019.11.21)
# Active-Active Idempotency Store & Token Vault spanning Mumbai and Hyderabad

resource "aws_dynamodb_table" "idempotency_table" {
  name             = "paysecure_idempotency_vault"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "PK"
  range_key        = "SK"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "N"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.primary_mrk.arn
  }

  # Secondary Region Replica: ap-south-2 (Hyderabad)
  replica {
    region_name = var.dr_region
    kms_key_arn = aws_kms_replica_key.dr_mrk.arn
    point_in_time_recovery = true
    propagate_tags         = true
  }

  global_secondary_index {
    name               = "GSI_CreatedAt"
    hash_key           = "PK"
    range_key          = "created_at"
    projection_type    = "ALL"
  }

  tags = {
    Name = "paysecure-idempotency-vault"
    Type = "GlobalTable"
  }
}
