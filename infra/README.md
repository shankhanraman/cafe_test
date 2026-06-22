# Infrastructure & CI/CD — cafe_test

Two deployment paths, both provisioned with Terraform and driven by GitHub Actions:

- **Backend** (Spring Boot, `backend/`): GitHub Actions → ECR → Argo CD → Kubernetes (EKS).
- **Frontend** (Vite/React, `frontend/`): GitHub Actions → S3 (private) → CloudFront (HTTPS).

Resource names use `cafe-test`; the AWS account ID is never committed — it comes from the GitHub
Secret `AWS_ACCOUNT_ID` (resolved by `aws-actions/amazon-ecr-login` at run time).

```
infra/terraform/   VPC, EKS, ECR, IAM (CI user), S3+CloudFront (frontend), S3-backed state
infra/k8s/backend/ Deployment, Service (ClusterIP), Secret (template)
argocd/            Argo CD Application (auto-sync from infra/k8s/backend)
.github/workflows/backend.yml    test → build → push to ECR → patch manifest → commit
.github/workflows/frontend.yml   test → build → sync to S3 → invalidate CloudFront
```

## Prerequisites

- An AWS account, with the AWS CLI installed and authenticated (`aws configure`).
- [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.6 and `kubectl`.
- A GitHub repo you can add Actions Secrets to.

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
     and `terraform output github_actions_secret_access_key` (the CI IAM user; least-privilege ECR push
     + frontend S3/CloudFront deploy).
   - `AWS_ACCOUNT_ID` — your 12-digit account id (used to form the ECR registry URL).
   - `FRONTEND_BUCKET` — from `terraform output frontend_bucket_name`.
   - `CLOUDFRONT_DISTRIBUTION_ID` — from `terraform output frontend_cloudfront_distribution_id`.
   `GITHUB_TOKEN` is provided automatically.
4. **Create the namespace and DB secrets** (do not commit real values). The backend talks to an
   in-cluster Postgres (`infra/k8s/postgres`) at `postgres.cafe-test.svc.cluster.local:5432`; the two
   passwords must match.
   ```bash
   kubectl create namespace cafe-test
   PGPASS='choose-a-strong-password'
   # Postgres pod credentials
   kubectl -n cafe-test create secret generic cafe-test-postgres-secrets \
     --from-literal=POSTGRES_USER=arogya \
     --from-literal=POSTGRES_PASSWORD="$PGPASS" \
     --from-literal=POSTGRES_DB=arogya
   # Backend connection (same password)
   kubectl -n cafe-test create secret generic cafe-test-backend-secrets \
     --from-literal=SPRING_DATASOURCE_URL='jdbc:postgresql://postgres.cafe-test.svc.cluster.local:5432/arogya' \
     --from-literal=SPRING_DATASOURCE_USERNAME=arogya \
     --from-literal=SPRING_DATASOURCE_PASSWORD="$PGPASS"
   ```
   For production, point `SPRING_DATASOURCE_URL` at AWS RDS instead and skip the Postgres pod.
   The Postgres `PersistentVolumeClaim` needs the EBS CSI driver — it's enabled in `eks.tf`
   (`cluster_addons.aws-ebs-csi-driver`), which also provides a default `gp2` StorageClass.
5. **Install Argo CD and register the apps** (Postgres + backend):
   ```bash
   kubectl create namespace argocd
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
   kubectl apply -f argocd/   # applies both postgres-app.yaml and backend-app.yaml
   ```
   Postgres comes up first; the backend may crash-loop briefly until the DB is ready, then Flyway
   migrates and it goes healthy.
6. **Push to `main`** — the workflow runs tests, builds the image, pushes to ECR, rewrites the image
   tag in `infra/k8s/backend/deployment.yaml`, and commits. Argo CD then auto-syncs the new image to
   the cluster.

## Notes
- Backend Service is `ClusterIP` (internal). Expose it via an Ingress/ALB or a frontend when needed.
- Health probes use Spring Boot Actuator (`/actuator/health/readiness` and `/liveness`).
- The Dockerfile lives in `backend/` and is reused by the workflow.
- The frontend S3 bucket is **private**; it's only reachable through CloudFront (HTTPS). CloudFront
  serves `index.html` for unknown paths so client-side routing works.
- For a custom domain on the frontend, add an ACM certificate (in `us-east-1`) and `aliases` to the
  CloudFront distribution in `infra/terraform/s3-frontend.tf`.
