# Deploy runbook — cafe_test (full stack)

Exact, ordered commands to deploy the **backend (EKS via Argo CD)** and **frontend (S3 + CloudFront)**
to AWS account **835253518413** in **us-east-1**. The IaC (`infra/terraform`), K8s manifests
(`infra/k8s`), Argo CD apps (`argocd/`), and GitHub Actions (`.github/workflows/`) are already built;
this is the execute-and-wire-up sequence.

> 💸 **Cost warning.** This provisions an EKS control plane (~$73/mo), 2× t3.medium nodes (~$60/mo),
> NAT gateway(s) (~$32/mo each), an NLB, and CloudFront. Roughly **$150–200/mo** while running.
> Tear down with `terraform destroy` (see end) when done.

Prereqs already confirmed on this machine: AWS CLI (authed as `user/skhd`), Terraform 1.15, kubectl 1.34.

> ⚠️ **GitOps reads from GitHub `main`, not your local tree.** Argo CD syncs `infra/k8s/**` from
> `github.com/shankhanraman/cafe_test.git@HEAD`, and the CI workflows build from the pushed branch. So
> **commit and push everything to `main` first** — this session's changes (frontend bills→receiving
> realignment, backend CORS `WebConfig`, the billscan sidecar fix, these manifests) must be on `main` or
> the cluster/CI won't see them. If the repo is **private**, also register repo credentials in Argo CD
> (`argocd repo add` or a `repo-*` Secret) so it can pull.

---

## 1. One-time: Terraform remote-state store

```bash
aws s3api create-bucket --bucket cafe-test-terraform-state --region us-east-1
aws s3api put-bucket-versioning --bucket cafe-test-terraform-state \
  --versioning-configuration Status=Enabled
aws dynamodb create-table --table-name cafe-test-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1
```

## 2. Provision base infra (phase 1 — `enable_api_origin=false`, the default)

```bash
cd infra/terraform
terraform init          # uses the S3 backend created above
terraform apply         # ~15–20 min — EKS is the slow part
```

This creates: VPC, EKS (1.33, t3.medium ×2), ECR `cafe-test-backend`, the CI IAM user,
and the **private S3 bucket + CloudFront** (static frontend only; `/api/*` not routed yet).

## 3. Connect kubectl, create namespace + DB secrets

```bash
# Use the command Terraform printed as `configure_kubectl`, e.g.:
aws eks update-kubeconfig --region us-east-1 --name "$(terraform output -raw cluster_name)"

kubectl create namespace cafe-test

PGPASS='choose-a-strong-password'
kubectl -n cafe-test create secret generic cafe-test-postgres-secrets \
  --from-literal=POSTGRES_USER=arogya \
  --from-literal=POSTGRES_PASSWORD="$PGPASS" \
  --from-literal=POSTGRES_DB=arogya
kubectl -n cafe-test create secret generic cafe-test-backend-secrets \
  --from-literal=SPRING_DATASOURCE_URL='jdbc:postgresql://postgres.cafe-test.svc.cluster.local:5432/arogya' \
  --from-literal=SPRING_DATASOURCE_USERNAME=arogya \
  --from-literal=SPRING_DATASOURCE_PASSWORD="$PGPASS"
```

(For production, point `SPRING_DATASOURCE_URL` at RDS and skip the in-cluster Postgres app.)

## 4. Add GitHub Actions secrets

From `infra/terraform` (values come from Terraform outputs). With the `gh` CLI from the repo root:

```bash
cd infra/terraform
gh secret set AWS_ACCESS_KEY_ID         --body "$(terraform output -raw github_actions_access_key_id)"
gh secret set AWS_SECRET_ACCESS_KEY     --body "$(terraform output -raw github_actions_secret_access_key)"
gh secret set FRONTEND_BUCKET           --body "$(terraform output -raw frontend_bucket_name)"
gh secret set CLOUDFRONT_DISTRIBUTION_ID --body "$(terraform output -raw frontend_cloudfront_distribution_id)"
```

(Or set them in GitHub → Settings → Secrets and variables → Actions. `GITHUB_TOKEN` is automatic.)

## 5. Install Argo CD and register the apps

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f argocd/     # postgres-app.yaml + backend-app.yaml
```

Postgres comes up first. **The backend pod will `ImagePullBackOff` at first** — the image tag in
`infra/k8s/backend/deployment.yaml` is a placeholder until the backend CI builds a real one (next step).

## 6. Build & push the first backend image (bootstrap)

The backend workflow runs on a push to `main` touching `backend/**`; it builds, pushes to ECR, rewrites
the image tag in the manifest, and commits — then Argo CD syncs. To bootstrap, push any commit (e.g. this
runbook) and let it run, **or** build the first image by hand:

```bash
cd backend
ACCOUNT=835253518413; REGION=us-east-1; REPO=cafe-test-backend; TAG=bootstrap
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
docker build -t $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:$TAG .
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:$TAG
# point the manifest at it and let Argo CD sync:
cd ../infra/k8s/backend
sed -i "s|image: .*cafe-test-backend:.*|image: $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:$TAG|g" deployment.yaml
git add deployment.yaml && git commit -m "ci: bootstrap backend image" && git push
```

Watch it go healthy: `kubectl -n cafe-test get pods -w` (backend may crash-loop briefly until Flyway migrates).

## 7. Wire CloudFront `/api/*` → backend NLB (phase 2)

Once the backend Service has an NLB hostname:

```bash
kubectl -n cafe-test get svc cafe-test-backend -o wide   # EXTERNAL-IP shows an *.elb.amazonaws.com name
cd infra/terraform
terraform apply -var enable_api_origin=true              # reads the NLB hostname, adds the /api/* behavior
```

Now the SPA's relative `/api/*` calls are proxied by CloudFront to the backend — **same origin, no CORS**.

## 8. Deploy the frontend

Push any change under `frontend/**` to `main` (or re-run the Frontend workflow). It builds (production mode →
mocks off, relative `/api`), syncs to S3, and invalidates CloudFront.

Open the app: `terraform output -raw frontend_url`.

---

## Known limitations baked into this deploy

- **Bill scanning is disabled.** The `billscan` sidecar in `infra/k8s/backend/deployment.yaml` is
  commented out — it has no source in this repo, no ECR repo, and no CI to build it, and an unpullable
  sidecar would keep the whole backend pod `NotReady`. Consequence: `POST /api/receiving/scan` returns
  5xx; everything else (suppliers, inventory, menu, sales) works. To enable: publish a billscan image to
  ECR, then uncomment the sidecar (or run billscan as its own Deployment+Service and set `BILLSCAN_BASE_URL`
  in `cafe-test-backend-secrets`).
- `frontend/.github/workflows/ci.yml` is **inert** — GitHub Actions only reads workflows under the repo-root
  `.github/workflows/`. It also references a non-existent `pnpm-lock.yaml`. The active pipelines are
  `.github/workflows/{backend,frontend}.yml` (npm-based). Safe to delete the stray file.
- CORS isn't needed in production (CloudFront serves SPA + `/api` same-origin). The backend `WebConfig`
  CORS rule (`http://localhost:5173`) only matters for local direct-call dev.

## Teardown (stop the bill)

```bash
kubectl delete -f argocd/ ; kubectl delete namespace cafe-test argocd   # frees the NLB first
cd infra/terraform && terraform destroy
```
> Destroy the NLB-backed Service (step above) before `terraform destroy`, or the VPC delete can hang on the
> leftover load balancer / ENIs.
