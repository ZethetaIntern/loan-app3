terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

# Primary Region Provider: ap-south-1 (Mumbai)
provider "aws" {
  region = var.primary_region

  default_tags {
    tags = {
      Project        = "PaySecure-MultiRegion-DR"
      Organization   = "PaySecure Gateway Private Limited"
      Environment    = var.environment
      ManagedBy      = "Terraform"
      ComplianceTier = "PCI-DSS-v4.0-RBI-Regulated"
      Classification = "Strictly-Confidential-BFSI"
    }
  }
}

# Secondary DR Region Provider: ap-south-2 (Hyderabad)
provider "aws" {
  alias  = "dr"
  region = var.dr_region

  default_tags {
    tags = {
      Project        = "PaySecure-MultiRegion-DR"
      Organization   = "PaySecure Gateway Private Limited"
      Environment    = var.environment
      ManagedBy      = "Terraform"
      ComplianceTier = "PCI-DSS-v4.0-RBI-Regulated"
      Classification = "Strictly-Confidential-BFSI"
    }
  }
}
