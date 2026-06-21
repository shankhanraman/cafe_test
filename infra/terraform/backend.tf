terraform {
  backend "s3" {
    bucket         = "cafe-test-terraform-state"
    key            = "infra/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "cafe-test-terraform-locks"
  }
}
