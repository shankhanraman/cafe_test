# Infrastructure & CI/CD — cafe_test backend

GitHub Actions → ECR → Argo CD → Kubernetes (EKS), provisioned with Terraform. Backend only
(Spring Boot, `backend/`). Resource names use `cafe-test`; the AWS account ID is never committed —
it comes from the GitHub Secret `AWS_ACCOUNT_ID` (resolved by `aws-actions/amazon-ecr-login` at run
time).

```
infra/terraform/   VPC, EKS, ECR, IAM (CI user), S3-backed state
infra/k8s/backend/ Deployment, Service (ClusterIP), Secret (template)
argocd/            Argo CD Application (auto-sync from infra/k8s/backend)
.github/workflows/backend.yml   test → build → push to ECR → patch manifest → commit
```

## What to do now

1. **Create the Terraform state store (once):**
   ```bash
   aws s3api create-bucket --bucket cafe-test-terraform-state --region us-east-1
   aws s3api put-bucket-versioning --bucket cafe-test-terraform-state \
     --versioning-configuration Status=Enabled
   aws dynamodb create-table --table-name cafe-test-terraform-locks \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST --region us-east-1
   ```
2. **Provision infra:**
   ```bash
   cd infra/terraform && terraform init && terraform apply
   ```
   Then configure kubectl with the printed `configure_kubectl` command.
3. **Add GitHub repo Secrets** (Settings → Secrets and variables → Actions):
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — from `terraform output github_actions_access_key_id`
     and `github_actions_secret_access_key` (the CI IAM user; least-privilege ECR push).
   - `AWS_ACCOUNT_ID` — your 12-digit account id (used to form the ECR registry URL).
   `GITHUB_TOKEN` is provided automatically.
4. **Provide the backend's DB secret** (do not commit real values):
   ```bash
   kubectl create namespace cafe-test
   kubectl -n cafe-test create secret generic cafe-test-backend-secrets \
     --from-literal=SPRING_DATASOURCE_URL='jdbc:postgresql://<rds-endpoint>:5432/arogya' \
     --from-literal=SPRING_DATASOURCE_USERNAME='<user>' \
     --from-literal=SPRING_DATASOURCE_PASSWORD='<pass>'
   ```
   (Point the URL at a managed Postgres such as AWS RDS — Terraform here provisions the cluster, not the DB.)
5. **Install Argo CD and register the app:**
   ```bash
   kubectl create namespace argocd
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
   kubectl apply -f argocd/
   ```
6. **Push to `main`** — the workflow runs tests, builds the image, pushes to ECR, rewrites the image
   tag in `infra/k8s/backend/deployment.yaml`, and commits. Argo CD then auto-syncs the new image to
   the cluster.

## Notes
- Backend Service is `ClusterIP` (internal). Expose it via an Ingress/ALB or a frontend when needed.
- Health probes use Spring Boot Actuator (`/actuator/health/readiness` and `/liveness`).
- The Dockerfile lives in `backend/` and is reused by the workflow.
