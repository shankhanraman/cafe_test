output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "configure_kubectl" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

output "ecr_backend_url" {
  description = "Backend ECR repository URL"
  value       = aws_ecr_repository.backend.repository_url
}

output "frontend_bucket_name" {
  description = "S3 bucket hosting the frontend — set as GitHub Secret FRONTEND_BUCKET"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_cloudfront_distribution_id" {
  description = "CloudFront distribution ID — set as GitHub Secret CLOUDFRONT_DISTRIBUTION_ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "frontend_url" {
  description = "Public URL of the frontend"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "github_actions_access_key_id" {
  description = "AWS access key ID for GitHub Actions — add as GitHub Secret AWS_ACCESS_KEY_ID"
  value       = aws_iam_access_key.github_actions.id
  sensitive   = true
}

output "github_actions_secret_access_key" {
  description = "AWS secret access key for GitHub Actions — add as GitHub Secret AWS_SECRET_ACCESS_KEY"
  value       = aws_iam_access_key.github_actions.secret
  sensitive   = true
}
