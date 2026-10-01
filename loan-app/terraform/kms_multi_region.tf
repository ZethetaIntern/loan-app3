# AWS KMS Multi-Region Customer Managed Keys (MRK)
# Zero cross-region decryption dependency (PCI-DSS v4.0 Requirement 3.5 & 3.6 compliant)

resource "aws_kms_key" "primary_mrk" {
  description             = "PaySecure Multi-Region Primary Key for Card Tokens and Ledger Encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::112233445566:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow PaySecure Workload Cryptographic Operations"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::112233445566:role/paysecure-eks-payment-orchestrator",
            "arn:aws:iam::112233445566:role/paysecure-eks-ledger-engine"
          ]
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "paysecure-mrk-primary-mumbai"
    Compliance  = "PCI-DSS-v4.0"
  }
}

resource "aws_kms_alias" "primary_mrk_alias" {
  name          = "alias/paysecure-multi-region-key"
  target_key_id = aws_kms_key.primary_mrk.key_id
}

# Replica Multi-Region Key in Hyderabad (ap-south-2)
resource "aws_kms_replica_key" "dr_mrk" {
  provider                = aws.dr
  description             = "PaySecure Multi-Region Replica Key in Hyderabad (ap-south-2)"
  deletion_window_in_days = 30
  primary_key_arn         = aws_kms_key.primary_mrk.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions in DR"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::112233445566:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Hyderabad Workload Decryption"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::112233445566:role/paysecure-eks-payment-orchestrator-hyd",
            "arn:aws:iam::112233445566:role/paysecure-eks-ledger-engine-hyd"
          ]
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "paysecure-mrk-replica-hyderabad"
    Compliance  = "PCI-DSS-v4.0"
  }
}

resource "aws_kms_alias" "dr_mrk_alias" {
  provider      = aws.dr
  name          = "alias/paysecure-multi-region-key"
  target_key_id = aws_kms_replica_key.dr_mrk.key_id
}
