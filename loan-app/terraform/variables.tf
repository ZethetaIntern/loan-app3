variable "primary_region" {
  type        = string
  description = "AWS Primary Region (Mumbai)"
  default     = "ap-south-1"
}

variable "dr_region" {
  type        = string
  description = "AWS Disaster Recovery Region (Hyderabad)"
  default     = "ap-south-2"
}

variable "environment" {
  type        = string
  description = "Deployment Environment"
  default     = "production"
}

variable "domain_name" {
  type        = string
  description = "Apex Domain for PaySecure API"
  default     = "api.paysecure.in"
}

variable "mumbai_vpc_cidr" {
  type        = string
  description = "CIDR block for Mumbai Primary VPC"
  default     = "10.100.0.0/16"
}

variable "hyderabad_vpc_cidr" {
  type        = string
  description = "CIDR block for Hyderabad DR VPC"
  default     = "10.200.0.0/16"
}

variable "aurora_instance_class" {
  type        = string
  description = "Aurora PostgreSQL DB instance class"
  default     = "db.r6g.8xlarge"
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache Redis node type"
  default     = "cache.r6g.2xlarge"
}

variable "msk_broker_instance_type" {
  type        = string
  description = "Amazon MSK Kafka broker instance type"
  default     = "kafka.m5.2xlarge"
}
