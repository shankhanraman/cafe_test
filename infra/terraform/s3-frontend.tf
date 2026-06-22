# ----------------------------------------------------------------------------
# Frontend hosting: private S3 bucket served over HTTPS via CloudFront (OAC).
# The bucket stays fully private; only CloudFront can read it.
# ----------------------------------------------------------------------------

resource "aws_s3_bucket" "frontend" {
  bucket = "${var.project_name}-frontend"

  tags = {
    Project = var.project_name
  }
}

# Keep the bucket completely private — access is only through CloudFront.
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Origin Access Control lets CloudFront sign requests to the private bucket.
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# SPA routing scoped to the frontend only. Rewrites extensionless, non-/api paths
# (e.g. /menu) to /index.html so React Router handles them. Crucially, it does NOT
# touch /api/* — so real backend 404/403 responses reach the browser intact,
# unlike a distribution-wide custom_error_response.
resource "aws_cloudfront_function" "spa_router" {
  name    = "${var.project_name}-spa-router"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrite extensionless non-/api paths to /index.html for SPA routing"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      // Leave API calls untouched so backend error codes pass through.
      if (uri.startsWith('/api/')) { return request; }
      // Real files (with an extension) are served as-is.
      if (uri.includes('.')) { return request; }
      // Client-side route -> serve the SPA entrypoint.
      request.uri = '/index.html';
      return request;
    }
  EOT
}

# Phase 2 only: read the backend Service's NLB hostname from the live cluster so
# CloudFront can route /api/* to it. Gated by enable_api_origin because the
# Service (and its NLB) only exist after the backend is deployed via Argo CD.
data "kubernetes_service" "backend" {
  count = var.enable_api_origin ? 1 : 0
  metadata {
    name      = "cafe-test-backend"
    namespace = "cafe-test"
  }
}

locals {
  backend_nlb_hostname = var.enable_api_origin ? data.kubernetes_service.backend[0].status[0].load_balancer[0].ingress[0].hostname : null
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "${var.project_name} frontend"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-${aws_s3_bucket.frontend.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Phase 2: backend API origin (the internet-facing NLB). CloudFront talks to it
  # over plain HTTP on port 80; the NLB forwards to the backend pods on 8080.
  dynamic "origin" {
    for_each = var.enable_api_origin ? [1] : []
    content {
      domain_name = local.backend_nlb_hostname
      origin_id   = "nlb-backend"
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "http-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3-${aws_s3_bucket.frontend.id}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_router.arn
    }
  }

  # Phase 2: route /api/* to the backend NLB. APIs are not cached (TTLs = 0) and
  # all query strings, cookies, and headers (incl. Authorization) are forwarded.
  dynamic "ordered_cache_behavior" {
    for_each = var.enable_api_origin ? [1] : []
    content {
      path_pattern           = "/api/*"
      target_origin_id       = "nlb-backend"
      viewer_protocol_policy = "redirect-to-https"
      allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods         = ["GET", "HEAD"]
      compress               = true

      forwarded_values {
        query_string = true
        headers      = ["*"]
        cookies {
          forward = "all"
        }
      }

      min_ttl     = 0
      default_ttl = 0
      max_ttl     = 0
    }
  }

  # SPA routing is handled by the spa_router CloudFront Function (viewer-request)
  # on the default behavior, scoped to non-/api paths — see above.

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Project = var.project_name
  }
}

# Allow only this CloudFront distribution to read objects from the bucket.
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontRead"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}
