variable "project_name" {
  description = "Project name used to prefix all resources"
  type        = string
  default     = "cafe-test"
}

variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-east-1"
}

variable "cluster_version" {
  description = "Kubernetes version for EKS"
  type        = string
  default     = "1.29"
}

variable "node_instance_type" {
  description = "EC2 instance type for EKS nodes"
  type        = string
  default     = "t3.medium"
}

variable "node_min_size" {
  type    = number
  default = 1
}

variable "node_max_size" {
  type    = number
  default = 4
}

variable "node_desired_size" {
  type    = number
  default = 2
}

# Two-phase switch for frontend->backend connectivity.
# Phase 1 (false): provision everything except the CloudFront /api/* route.
#   The backend NLB does not exist yet, so its hostname cannot be read.
# Phase 2 (true): after the backend Service has an NLB hostname, Terraform reads
#   it via the kubernetes_service data source and adds the /api/* origin/behavior.
variable "enable_api_origin" {
  description = "Wire CloudFront /api/* to the backend NLB. Enable only after the backend Service has an NLB hostname."
  type        = bool
  default     = false
}
